import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Checks if a TypeScript file has proper JSDoc documentation for all exports.
 * This test verifies the three JSDoc scenarios:
 * 1. All exported functions have JSDoc comments
 * 2. JSDoc comments include parameter descriptions  
 * 3. JSDoc comments include return descriptions
 */
describe('JSDoc Documentation Coverage', () => {
  const srcDir = path.join(__dirname, '..')
  
  // Get all TypeScript files in the src directory recursively
  function getAllTsFiles(dir: string): string[] {
    let results: string[] = []
    const list = fs.readdirSync(dir)
    list.forEach(file => {
      const filePath = path.join(dir, file)
      const stat = fs.statSync(filePath)
      if (stat && stat.isDirectory()) {
        results = results.concat(getAllTsFiles(filePath))
      } else if (file.endsWith('.ts') && !file.endsWith('.test.ts')) {
        results.push(filePath)
      }
    })
    return results
  }

  const tsFiles = getAllTsFiles(srcDir)

  it('all exported functions have JSDoc comments', () => {
    const missingJSDoc: string[] = []
    
    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf8')
      const lines = content.split('\n')
      
      // Simple regex to find exported functions, classes, interfaces, and type aliases
      const exportPatterns = [
        /^export\s+(async\s+)?function\s+(\w+)/,
        /^export\s+class\s+(\w+)/,
        /^export\s+interface\s+(\w+)/,
        /^export\s+type\s+(\w+)/,
        /^export\s+enum\s+(\w+)/
      ]
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        
        // Skip if it's already documented or not an export
        if (line.startsWith('/**') || line.startsWith('/*') || !line.startsWith('export ')) {
          continue
        }
        
        // Check if this line matches any export pattern
        let isExportDeclaration = false
        for (const pattern of exportPatterns) {
          if (pattern.test(line)) {
            isExportDeclaration = true
            break
          }
        }
        
        if (isExportDeclaration) {
          // Check if there's a JSDoc comment immediately before
          let hasJSDoc = false
          let j = i - 1
          while (j >= 0 && lines[j].trim() === '') {
            j--
          }
          if (j >= 0 && lines[j].trim().startsWith('/**')) {
            hasJSDoc = true
          }
          
          if (!hasJSDoc) {
            const fileName = path.relative(srcDir, file)
            const functionNameMatch = line.match(/(?:function|class|interface|type|enum)\s+(\w+)/)
            const functionName = functionNameMatch ? functionNameMatch[1] : 'unknown'
            missingJSDoc.push(`${fileName}:${i + 1} - ${functionName}`)
          }
        }
      }
    }
    
    if (missingJSDoc.length > 0) {
      console.log('Missing JSDoc documentation for:')
      missingJSDoc.forEach(item => console.log(`  ${item}`))
    }
    expect(missingJSDoc).toHaveLength(0)
  })

  it('JSDoc comments include parameter descriptions', () => {
    const missingParamDocs: string[] = []
    
    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf8')
      const lines = content.split('\n')
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        
        // Look for JSDoc comments followed by function declarations
        if (line.startsWith('/**')) {
          // Find the end of the JSDoc comment
          let docEnd = i
          while (docEnd < lines.length && !lines[docEnd].trim().endsWith('*/')) {
            docEnd++
          }
          docEnd++ // Move to the line after the comment
          
          // Skip empty lines
          while (docEnd < lines.length && lines[docEnd].trim() === '') {
            docEnd++
          }
          
          if (docEnd < lines.length) {
            const nextLine = lines[docEnd].trim()
            // Check if it's an exported function with parameters
            const funcMatch = nextLine.match(/^export\s+(?:async\s+)?function\s+\w+\s*\(([^)]+)\)/)
            if (funcMatch && funcMatch[1].trim() !== '') {
              const params = funcMatch[1].split(',').map(p => p.trim())
              const paramNames = params.map(p => {
                const nameMatch = p.match(/(\w+)(?:\s*:|\s*=\s*|\s*$)/)
                return nameMatch ? nameMatch[1] : p
              }).filter(name => name && name !== '...')

              // Extract @param tags from the JSDoc
              const docLines = lines.slice(i, docEnd)
              const paramTags: string[] = []
              for (const docLine of docLines) {
                const paramMatch = docLine.match(/@\s*param\s+(\{[^}]+\})?\s*(\w+)/)
                if (paramMatch) {
                  paramTags.push(paramMatch[2])
                }
              }
              
              // Check for missing parameter documentation
              for (const paramName of paramNames) {
                if (!paramTags.includes(paramName)) {
                  const fileName = path.relative(srcDir, file)
                  missingParamDocs.push(`${fileName}:${docEnd + 1} - parameter '${paramName}'`)
                }
              }
            }
          }
        }
      }
    }
    
    if (missingParamDocs.length > 0) {
      console.log('Missing parameter documentation in JSDoc:')
      missingParamDocs.forEach(item => console.log(`  ${item}`))
    }
    expect(missingParamDocs).toHaveLength(0)
  })

  it('JSDoc comments include return descriptions', () => {
    const missingReturnDocs: string[] = []
    
    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf8')
      const lines = content.split('\n')
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        
        // Look for JSDoc comments followed by function declarations that return values
        if (line.startsWith('/**')) {
          // Find the end of the JSDoc comment
          let docEnd = i
          while (docEnd < lines.length && !lines[docEnd].trim().endsWith('*/')) {
            docEnd++
          }
          docEnd++ // Move to the line after the comment
          
          // Skip empty lines
          while (docEnd < lines.length && lines[docEnd].trim() === '') {
            docEnd++
          }
          
          if (docEnd < lines.length) {
            const nextLine = lines[docEnd].trim()
            // Check if it's an exported function that returns a value (not void)
            const funcMatch = nextLine.match(/^export\s+(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*:\s*([^{\s]+)/)
            if (funcMatch) {
              const returnType = funcMatch[1].trim()
              // Skip void, undefined, and Promise<void> returns
              if (returnType !== 'void' && returnType !== 'undefined' && !returnType.includes('Promise<void>')) {
                // Check if the JSDoc has a @returns tag
                const docLines = lines.slice(i, docEnd)
                let hasReturnsTag = false
                for (const docLine of docLines) {
                  if (docLine.includes('@returns') || docLine.includes('@return')) {
                    hasReturnsTag = true
                    break
                  }
                }
                
                if (!hasReturnsTag) {
                  const fileName = path.relative(srcDir, file)
                  const funcNameMatch = nextLine.match(/function\s+(\w+)/)
                  const funcName = funcNameMatch ? funcNameMatch[1] : 'unknown'
                  missingReturnDocs.push(`${fileName}:${docEnd + 1} - function '${funcName}'`)
                }
              }
            }
          }
        }
      }
    }
    
    if (missingReturnDocs.length > 0) {
      console.log('Missing return documentation in JSDoc:')
      missingReturnDocs.forEach(item => console.log(`  ${item}`))
    }
    expect(missingReturnDocs).toHaveLength(0)
  })
})