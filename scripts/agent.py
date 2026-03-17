#!/usr/bin/env python3
"""
BAADD agent — multi-provider AI agent with tool use.
Reads a prompt from stdin, runs the agent loop, prints output.

Usage:
    ANTHROPIC_API_KEY=sk-...  python3 scripts/agent.py < prompt.txt  # Anthropic (priority)
    MOONSHOT_API_KEY=sk-...   python3 scripts/agent.py < prompt.txt  # Kimi
    DASHSCOPE_API_KEY=sk-...  python3 scripts/agent.py < prompt.txt  # Alibaba/Qwen
    OPENAI_API_KEY=sk-...     python3 scripts/agent.py < prompt.txt  # OpenAI
    GROQ_API_KEY=gsk_...      python3 scripts/agent.py < prompt.txt  # Groq
    OLLAMA_HOST=http://...    python3 scripts/agent.py --model llama3 < prompt.txt

Flags:
    --model     Override default model for the detected provider
    --provider  Force a specific provider (anthropic|moonshot|dashscope|openai|groq|ollama)
    --skills    Path to skills directory
    --mode      evolve|bootstrap (affects wrap-up reminder content)

Provider priority (first key found wins):
    ANTHROPIC_API_KEY > MOONSHOT_API_KEY > DASHSCOPE_API_KEY > OPENAI_API_KEY > GROQ_API_KEY > OLLAMA_HOST

Dependencies:
    pip install anthropic openai
"""

import os
import sys
import json
import subprocess
import argparse
import glob as globmod


def load_dotenv(path=".env"):
    """Load .env file into os.environ without overriding existing vars.
    Supports KEY=value, KEY="value", KEY='value', and # comments.
    """
    if not os.path.exists(path):
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip()
            # Strip surrounding quotes
            if len(value) >= 2 and value[0] in ('"', "'") and value[-1] == value[0]:
                value = value[1:-1]
            # Only set if not already in environment (explicit env vars take priority)
            if key and key not in os.environ:
                os.environ[key] = value


load_dotenv()

MAX_TOKENS = 8192
TOOL_OUTPUT_LIMIT = 12000

# Provider detection — ordered by priority
PROVIDER_PRIORITY = [
    ("anthropic",  "ANTHROPIC_API_KEY"),
    ("moonshot",   "MOONSHOT_API_KEY"),
    ("dashscope",  "DASHSCOPE_API_KEY"),
    ("openai",     "OPENAI_API_KEY"),
    ("groq",       "GROQ_API_KEY"),
]

PROVIDER_CONFIGS = {
    "anthropic": {
        "api_key_env":   "ANTHROPIC_API_KEY",
        "base_url":      None,
        "default_model": "claude-haiku-4-5-20251001",
    },
    "moonshot": {
        "api_key_env":   "MOONSHOT_API_KEY",
        "base_url":      "https://api.moonshot.cn/v1",
        "default_model": "kimi-latest",
    },
    "dashscope": {
        "api_key_env":   "DASHSCOPE_API_KEY",
        "base_url":      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        "default_model": "qwen-max",
    },
    "openai": {
        "api_key_env":   "OPENAI_API_KEY",
        "base_url":      None,
        "default_model": "gpt-4o",
    },
    "groq": {
        "api_key_env":   "GROQ_API_KEY",
        "base_url":      "https://api.groq.com/openai/v1",
        "default_model": "llama-3.3-70b-versatile",
    },
    "ollama": {
        "api_key_env":   None,
        "base_url":      None,  # resolved from OLLAMA_HOST at runtime
        "default_model": "llama3.2",
    },
}

# Tool definitions in Anthropic format (converted to OpenAI format where needed)
TOOLS = [
    {
        "name": "bash",
        "description": "Run a shell command and return its output.",
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Shell command to run"}
            },
            "required": ["command"]
        }
    },
    {
        "name": "read_file",
        "description": "Read the contents of a file.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Path to the file"}
            },
            "required": ["path"]
        }
    },
    {
        "name": "write_file",
        "description": "Write content to a file, creating it if it doesn't exist.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "content": {"type": "string"}
            },
            "required": ["path", "content"]
        }
    },
    {
        "name": "edit_file",
        "description": "Replace the first occurrence of old_str with new_str in a file.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "old_str": {"type": "string", "description": "Exact string to find"},
                "new_str": {"type": "string", "description": "Replacement string"}
            },
            "required": ["path", "old_str", "new_str"]
        }
    },
    {
        "name": "list_files",
        "description": "List files in a directory recursively.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Directory to list (default: .)"}
            }
        }
    },
    {
        "name": "search_files",
        "description": "Search for a pattern across all files in the project.",
        "input_schema": {
            "type": "object",
            "properties": {
                "pattern": {"type": "string", "description": "Text to search for"},
                "path": {"type": "string", "description": "Directory to search (default: .)"}
            },
            "required": ["pattern"]
        }
    }
]

# OpenAI-format version of the same tools
TOOLS_OPENAI = [
    {
        "type": "function",
        "function": {
            "name": t["name"],
            "description": t["description"],
            "parameters": t["input_schema"],
        }
    }
    for t in TOOLS
]


def detect_provider():
    """Return the first provider whose API key env var is set, or ollama if host is available."""
    for name, env_var in PROVIDER_PRIORITY:
        if os.environ.get(env_var):
            return name
    # Ollama: check OLLAMA_HOST or probe localhost
    if os.environ.get("OLLAMA_HOST"):
        return "ollama"
    try:
        import urllib.request
        urllib.request.urlopen("http://localhost:11434", timeout=1)
        return "ollama"
    except Exception:
        pass
    return None


def run_tool(name, input_data):
    """Execute a tool call and return the string result."""
    try:
        if name == "bash":
            result = subprocess.run(
                input_data["command"],
                shell=True,
                capture_output=True,
                text=True,
                timeout=300
            )
            output = result.stdout
            if result.stderr:
                output += "\n[stderr]\n" + result.stderr
            if not output.strip():
                output = f"(exit code: {result.returncode})"
            return output[:TOOL_OUTPUT_LIMIT]

        elif name == "read_file":
            path = input_data["path"]
            if not os.path.exists(path):
                return f"ERROR: file not found: {path}"
            with open(path) as f:
                content = f.read()
            if len(content) > TOOL_OUTPUT_LIMIT:
                content = content[:TOOL_OUTPUT_LIMIT] + f"\n[... truncated at {TOOL_OUTPUT_LIMIT} chars]"
            return content

        elif name == "write_file":
            path = input_data["path"]
            parent = os.path.dirname(path)
            if parent:
                os.makedirs(parent, exist_ok=True)
            with open(path, "w") as f:
                f.write(input_data["content"])
            return f"Written: {path}"

        elif name == "edit_file":
            path = input_data["path"]
            if not os.path.exists(path):
                return f"ERROR: file not found: {path}"
            with open(path) as f:
                content = f.read()
            old_str = input_data["old_str"]
            new_str = input_data["new_str"]
            if old_str not in content:
                return f"ERROR: string not found in {path}. Make sure the old_str matches exactly."
            new_content = content.replace(old_str, new_str, 1)
            with open(path, "w") as f:
                f.write(new_content)
            return f"Edited: {path}"

        elif name == "list_files":
            path = input_data.get("path", ".")
            result = subprocess.run(
                ["find", path, "-type", "f",
                 "-not", "-path", "*/.git/*",
                 "-not", "-path", "*/node_modules/*",
                 "-not", "-path", "*/target/*",
                 "-not", "-path", "*/__pycache__/*"],
                capture_output=True, text=True
            )
            output = result.stdout.strip()
            return output[:TOOL_OUTPUT_LIMIT] if output else "(empty)"

        elif name == "search_files":
            pattern = input_data["pattern"]
            path = input_data.get("path", ".")
            result = subprocess.run(
                ["grep", "-r", "--include=*", "-l", pattern, path],
                capture_output=True, text=True
            )
            files = result.stdout.strip()
            if not files:
                return f"No files found containing: {pattern}"
            result2 = subprocess.run(
                ["grep", "-r", "-n", "--include=*", pattern, path],
                capture_output=True, text=True
            )
            return (files + "\n\nMatching lines:\n" + result2.stdout)[:TOOL_OUTPUT_LIMIT]

    except subprocess.TimeoutExpired:
        return "ERROR: command timed out after 300s"
    except Exception as e:
        return f"ERROR: {e}"


def print_tool_call(name, input_data, result):
    """Print a coloured tool call summary with output preview."""
    if name == "bash":
        cmd_preview = input_data.get("command", "")[:120]
        print(f"\n\033[36m[{name}]\033[0m \033[90m$ {cmd_preview}\033[0m", flush=True)
    elif name == "write_file":
        path = input_data.get("path", "")
        content = input_data.get("content", "")
        lines = content.splitlines()
        print(f"\n\033[36m[{name}]\033[0m \033[90m{path} ({len(lines)} lines)\033[0m", flush=True)
        shown = "\n  ".join(lines[:4])
        suffix = f"\n  ... ({len(lines) - 4} more lines)" if len(lines) > 4 else ""
        print(f"  \033[90m{shown}{suffix}\033[0m", flush=True)
    elif name in ("read_file", "edit_file"):
        print(f"\n\033[36m[{name}]\033[0m \033[90m{input_data.get('path', '')}\033[0m", flush=True)
    else:
        print(f"\n\033[36m[{name}]\033[0m", flush=True)

    if result:
        preview = str(result).strip()
        if preview and preview != "(exit code: 0)":
            lines = preview.splitlines()
            shown = "\n  ".join(lines[:5])
            suffix = f"\n  ... ({len(lines) - 5} more lines)" if len(lines) > 5 else ""
            print(f"  \033[90m{shown}{suffix}\033[0m", flush=True)


def make_wrap_up_message(iteration, max_iterations, mode):
    if mode == "bootstrap":
        return (
            f"⚠️ You have used {iteration} of {max_iterations} allowed iterations. "
            "Stop any new work and wrap up the bootstrap:\n"
            "1. Run the build and tests — fix any failures.\n"
            "2. Commit all changes: git add -A && git commit -m \"Bootstrap: scaffold complete\"\n"
            "3. Create .baadd_initialized: touch .baadd_initialized && git add .baadd_initialized && git commit -m \"Bootstrap: mark initialized\"\n"
            "4. Write a Day 0 journal entry to JOURNAL.md.\n"
            "5. Commit the journal: git add JOURNAL.md && git commit -m \"Bootstrap: journal entry\"\n"
            "Do not start implementing any BDD scenarios."
        )
    return (
        f"⚠️ You have used {iteration} of {max_iterations} allowed iterations. "
        "Stop starting new work. Finish only what you are currently doing, then wrap up:\n"
        "1. Run the build and tests — fix any failures before committing.\n"
        "2. Update BDD_STATUS.md with current coverage.\n"
        "3. Write your journal entry to JOURNAL.md. Include: what you completed this session, "
        "which scenarios are still uncovered or failing, and exactly where the next session should pick up.\n"
        "4. Commit everything.\n"
        "Do not start any new scenarios."
    )


def load_skills(skills_dir):
    if not skills_dir or not os.path.isdir(skills_dir):
        return ""
    skill_texts = []
    for skill_file in sorted(globmod.glob(os.path.join(skills_dir, "**", "SKILL.md"), recursive=True)):
        try:
            with open(skill_file) as f:
                skill_texts.append(f.read())
        except Exception:
            pass
    return "\n\n---\n\n".join(skill_texts) if skill_texts else ""


def run_anthropic_loop(api_key, model, system_prompt, prompt, mode):
    try:
        import anthropic
    except ImportError:
        print("ERROR: anthropic package not installed. Run: pip install anthropic", file=sys.stderr)
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)
    messages = [{"role": "user", "content": prompt}]

    iteration = 0
    max_iterations = 75
    wrap_up_at = 70
    wrap_up_injected = False

    while iteration < max_iterations:
        iteration += 1

        if iteration >= wrap_up_at and not wrap_up_injected:
            print(f"\n\033[33m[agent: iteration {iteration}/{max_iterations} — injecting wrap-up reminder]\033[0m", flush=True)
            messages.append({"role": "user", "content": make_wrap_up_message(iteration, max_iterations, mode)})
            wrap_up_injected = True

        response = client.messages.create(
            model=model,
            max_tokens=MAX_TOKENS,
            system=system_prompt,
            tools=TOOLS,
            messages=messages
        )

        for block in response.content:
            if hasattr(block, "text") and block.text:
                print(block.text, end="", flush=True)

        if response.stop_reason == "end_turn":
            print("\n[BAADD agent done]", flush=True)
            break

        if response.stop_reason == "tool_use":
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = run_tool(block.name, block.input)
                    print_tool_call(block.name, block.input, result)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": str(result)
                    })
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})
        else:
            print(f"\n[stopped: {response.stop_reason}]", flush=True)
            break

    if iteration >= max_iterations:
        print(f"\n[BAADD agent: hit iteration limit ({max_iterations})]", flush=True)


def run_openai_loop(client, model, system_prompt, prompt, mode):
    """Agent loop for any OpenAI-compatible provider (Kimi, Alibaba, Groq, OpenAI, Ollama)."""
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": prompt},
    ]

    iteration = 0
    max_iterations = 75
    wrap_up_at = 70
    wrap_up_injected = False

    while iteration < max_iterations:
        iteration += 1

        if iteration >= wrap_up_at and not wrap_up_injected:
            print(f"\n\033[33m[agent: iteration {iteration}/{max_iterations} — injecting wrap-up reminder]\033[0m", flush=True)
            messages.append({"role": "user", "content": make_wrap_up_message(iteration, max_iterations, mode)})
            wrap_up_injected = True

        response = client.chat.completions.create(
            model=model,
            max_tokens=MAX_TOKENS,
            messages=messages,
            tools=TOOLS_OPENAI,
            tool_choice="auto",
        )

        choice = response.choices[0]
        msg = choice.message

        if msg.content:
            print(msg.content, end="", flush=True)

        if choice.finish_reason == "stop":
            print("\n[BAADD agent done]", flush=True)
            break

        if choice.finish_reason == "tool_calls":
            # Append assistant message (includes tool_calls metadata)
            messages.append(msg)

            for tool_call in msg.tool_calls:
                name = tool_call.function.name
                try:
                    input_data = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    input_data = {}
                result = run_tool(name, input_data)
                print_tool_call(name, input_data, result)
                messages.append({
                    "role":         "tool",
                    "tool_call_id": tool_call.id,
                    "content":      str(result),
                })
        else:
            print(f"\n[stopped: {choice.finish_reason}]", flush=True)
            break

    if iteration >= max_iterations:
        print(f"\n[BAADD agent: hit iteration limit ({max_iterations})]", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model",    default=None,
                        help="Override default model for the detected provider")
    parser.add_argument("--provider", default=None,
                        help="Force provider: anthropic|moonshot|dashscope|openai|groq|ollama")
    parser.add_argument("--skills",   default=None)
    parser.add_argument("--mode",     default="evolve", choices=["evolve", "bootstrap"])
    args = parser.parse_args()

    provider = args.provider or detect_provider()
    if not provider:
        print(
            "ERROR: No API key found. Set one of:\n"
            "  ANTHROPIC_API_KEY  — Anthropic Claude (priority)\n"
            "  MOONSHOT_API_KEY   — Kimi\n"
            "  DASHSCOPE_API_KEY  — Alibaba/Qwen\n"
            "  OPENAI_API_KEY     — OpenAI\n"
            "  GROQ_API_KEY       — Groq\n"
            "  OLLAMA_HOST        — Ollama (local)",
            file=sys.stderr
        )
        sys.exit(1)

    if provider not in PROVIDER_CONFIGS:
        print(f"ERROR: Unknown provider '{provider}'. Valid: {', '.join(PROVIDER_CONFIGS)}", file=sys.stderr)
        sys.exit(1)

    config = PROVIDER_CONFIGS[provider]
    model = args.model or config["default_model"]

    api_key = None
    if config["api_key_env"]:
        api_key = os.environ.get(config["api_key_env"])
        if not api_key:
            print(f"ERROR: {config['api_key_env']} not set", file=sys.stderr)
            sys.exit(1)

    prompt = sys.stdin.read().strip()
    if not prompt:
        print("ERROR: no prompt provided on stdin", file=sys.stderr)
        sys.exit(1)

    skills_text = load_skills(args.skills)
    system_prompt = "You are an expert software developer. You build software strictly according to BDD specifications."
    if skills_text:
        system_prompt += "\n\n" + skills_text

    print(f"[BAADD agent starting — provider: {provider}, model: {model}]", flush=True)

    if provider == "anthropic":
        run_anthropic_loop(api_key, model, system_prompt, prompt, args.mode)
        return

    # All other providers use the OpenAI-compatible client
    try:
        from openai import OpenAI
    except ImportError:
        print("ERROR: openai package not installed. Run: pip install openai", file=sys.stderr)
        sys.exit(1)

    base_url = config["base_url"]
    if provider == "ollama":
        host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
        base_url = host.rstrip("/") + "/v1"
        api_key = "ollama"  # OpenAI client requires a non-empty string

    client_kwargs = {"api_key": api_key}
    if base_url:
        client_kwargs["base_url"] = base_url

    client = OpenAI(**client_kwargs)
    run_openai_loop(client, model, system_prompt, prompt, args.mode)


if __name__ == "__main__":
    main()
