import type { Root, Paragraph, Text } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import type { FastMdTransformOptions, CustomTransformRule, TransformContext } from './index';
import { TransformPipeline } from './transform-pipeline';

/**
 * Create a Remark plugin that applies custom transformation rules
 */
export function createRemarkPlugin(options: FastMdTransformOptions): Plugin<[], Root> {
  return function fastMdRemarkPlugin() {
    // Create transform pipeline with custom rules
    const pipeline = new TransformPipeline(options.customRules);
    
    return async (tree: Root, file: any) => {
      const filepath = file.path || file.history?.[0] || 'unknown';
      
      // Create transform context
      const context: TransformContext = {
        filepath,
        content: file.value || '',
        frontmatter: file.data?.astro?.frontmatter || {},
        mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
        metadata: {}
      };
      
      // Execute beforeTransform hook
      if (options.hooks?.beforeTransform) {
        await options.hooks.beforeTransform(context);
      }
      
      // Apply pre-processing rules to the raw content
      if (options.customRules) {
        const preRules = options.customRules.filter(
          rule => rule.enabled !== false && rule.stage === 'pre'
        );
        
        if (preRules.length > 0) {
          // Collect all text nodes first
          const textNodes: Text[] = [];
          visit(tree, 'text', (node: Text) => {
            textNodes.push(node);
          });
          
          // Process them asynchronously
          for (const node of textNodes) {
            let text = node.value;
            
            for (const rule of preRules) {
              try {
                // Apply rule to text content
                if (rule.pattern) {
                  const pattern = typeof rule.pattern === 'string' 
                    ? new RegExp(rule.pattern, 'g')
                    : rule.pattern;
                  
                  if (pattern.test(text)) {
                    pattern.lastIndex = 0; // Reset regex
                    const result = rule.transform(text, context);
                    text = typeof result === 'string' ? result : await result;
                  }
                } else {
                  const result = rule.transform(text, context);
                  text = typeof result === 'string' ? result : await result;
                }
              } catch (err) {
                console.warn(`[Remark Plugin] Rule '${rule.name}' failed:`, err);
              }
            }
            
            node.value = text;
          }
        }
      }
      
      // Apply AST-level transformations
      // Collect nodes that need processing
      const nodesToProcess: Array<{node: any, type: string}> = [];
      
      visit(tree, (node: any) => {
        // Custom AST transformations can be added here
        // For example, transform specific node types
        
        if (node.type === 'paragraph') {
          nodesToProcess.push({node, type: 'paragraph'});
        } else if (node.type === 'heading') {
          nodesToProcess.push({node, type: 'heading'});
        } else if (node.type === 'code') {
          // Skip code blocks for text replacement rules
          return 'skip';
        }
      });
      
      // Process collected nodes asynchronously
      for (const {node, type} of nodesToProcess) {
        await processNode(node, options.customRules, context, type);
      }
      
      // Execute afterTransform hook
      if (options.hooks?.afterTransform) {
        // Note: In remark context, we work with AST, not HTML output
        const result = await options.hooks.afterTransform({
          ...context,
          output: file.value
        });
        
        if (result && result !== file.value) {
          file.value = result;
        }
      }
      
      return tree;
    };
  };
}

/**
 * Process a specific node type with custom rules
 */
async function processNode(
  node: any, 
  rules: CustomTransformRule[] | undefined,
  context: TransformContext,
  nodeType: string
) {
  if (!rules) return;
  
  // Filter rules that apply to this node type
  const applicableRules = rules.filter(rule => {
    if (rule.enabled === false) return false;
    // Add node type filtering if needed
    return true;
  });
  
  // Apply rules to text within the node
  if (node.children) {
    for (const child of node.children) {
      if (child.type === 'text') {
        let text = child.value;
        
        for (const rule of applicableRules) {
          try {
            text = await applyRuleToText(text, rule, context);
          } catch (err) {
            console.warn(`[Remark Plugin] Failed to apply rule '${rule.name}':`, err);
          }
        }
        
        child.value = text;
      }
    }
  }
}

/**
 * Apply a single rule to text content
 */
async function applyRuleToText(
  text: string, 
  rule: CustomTransformRule,
  context: TransformContext
): Promise<string> {
  if (rule.pattern) {
    const pattern = typeof rule.pattern === 'string' 
      ? new RegExp(rule.pattern, 'g')
      : rule.pattern;
    
    if (!pattern.test(text)) {
      return text;
    }
    
    // Reset regex for actual replacement
    if (pattern.global) {
      pattern.lastIndex = 0;
    }
  }
  
  const result = rule.transform(text, context);
  return typeof result === 'string' ? result : await Promise.resolve(result);
}

// Install unist-util-visit if not already installed
// This is a common utility for working with AST in remark/rehype