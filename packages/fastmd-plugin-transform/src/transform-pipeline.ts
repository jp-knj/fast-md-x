import type { CustomTransformRule, TransformContext } from './index';

/**
 * Transform pipeline for managing and executing custom transformation rules
 */
export class TransformPipeline {
  private rules: CustomTransformRule[] = [];
  
  constructor(rules?: CustomTransformRule[]) {
    if (rules) {
      this.addRules(rules);
    }
  }

  /**
   * Add multiple rules to the pipeline
   */
  addRules(rules: CustomTransformRule[]): void {
    this.rules.push(...rules);
    this.sortRules();
  }

  /**
   * Add a single rule to the pipeline
   */
  addRule(rule: CustomTransformRule): void {
    this.rules.push(rule);
    this.sortRules();
  }

  /**
   * Remove a rule by name
   */
  removeRule(name: string): boolean {
    const initialLength = this.rules.length;
    this.rules = this.rules.filter(rule => rule.name !== name);
    return this.rules.length < initialLength;
  }

  /**
   * Sort rules by priority (lower numbers first)
   */
  private sortRules(): void {
    this.rules.sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }

  /**
   * Execute rules for a specific stage
   */
  async executeStage(
    content: string, 
    context: TransformContext, 
    stage: 'pre' | 'post'
  ): Promise<string> {
    const stageRules = this.rules.filter(rule => 
      rule.enabled !== false && 
      (stage === 'pre' ? rule.stage === 'pre' : (!rule.stage || rule.stage === 'post'))
    );

    let result = content;
    for (const rule of stageRules) {
      try {
        result = await this.executeRule(rule, result, context);
      } catch (error) {
        console.error(`[TransformPipeline] Rule '${rule.name}' failed:`, error);
        // Continue with other rules even if one fails
      }
    }

    return result;
  }

  /**
   * Execute a single transformation rule
   */
  private async executeRule(
    rule: CustomTransformRule, 
    content: string, 
    context: TransformContext
  ): Promise<string> {
    // If rule has a pattern, check if it matches first
    if (rule.pattern) {
      const pattern = typeof rule.pattern === 'string' 
        ? new RegExp(rule.pattern, 'g')
        : rule.pattern;
      
      if (!pattern.test(content)) {
        return content; // Skip if pattern doesn't match
      }
      
      // Reset regex state for actual transformation
      if (pattern.global) {
        pattern.lastIndex = 0;
      }
    }

    // Execute the transformation
    return await rule.transform(content, context);
  }

  /**
   * Get all registered rules
   */
  getRules(): CustomTransformRule[] {
    return [...this.rules];
  }

  /**
   * Clear all rules
   */
  clear(): void {
    this.rules = [];
  }
}

/**
 * Built-in transformation rules
 */
export const builtInRules = {
  /**
   * Pattern-based replacement rule
   */
  patternReplace: (
    name: string,
    pattern: RegExp | string,
    replacement: string | ((match: string, ...args: any[]) => string),
    options?: Partial<CustomTransformRule>
  ): CustomTransformRule => ({
    name,
    pattern,
    transform: (content: string) => {
      const regex = typeof pattern === 'string' ? new RegExp(pattern, 'g') : pattern;
      return typeof replacement === 'string' 
        ? content.replace(regex, replacement)
        : content.replace(regex, replacement);
    },
    ...options
  }),

  /**
   * Custom function rule
   */
  customFunction: (
    name: string,
    fn: (content: string, context: TransformContext) => string | Promise<string>,
    options?: Partial<CustomTransformRule>
  ): CustomTransformRule => ({
    name,
    transform: fn,
    ...options
  }),

  /**
   * Wrapper rule for existing processors
   */
  processor: (
    name: string,
    processor: any,
    options?: Partial<CustomTransformRule>
  ): CustomTransformRule => ({
    name,
    transform: async (content: string, context: TransformContext) => {
      // This would integrate with remark/rehype processors
      // Implementation depends on the processor type
      if (typeof processor === 'function') {
        return await processor(content, context);
      }
      return content;
    },
    ...options
  })
};

/**
 * Rule composition utilities
 */
export const ruleComposition = {
  /**
   * Chain multiple rules together
   */
  chain: (
    name: string,
    rules: CustomTransformRule[],
    options?: Partial<CustomTransformRule>
  ): CustomTransformRule => ({
    name,
    transform: async (content: string, context: TransformContext) => {
      let result = content;
      for (const rule of rules) {
        if (rule.enabled !== false) {
          result = await rule.transform(result, context);
        }
      }
      return result;
    },
    ...options
  }),

  /**
   * Conditional rule execution
   */
  conditional: (
    name: string,
    condition: (context: TransformContext) => boolean | Promise<boolean>,
    rule: CustomTransformRule,
    options?: Partial<CustomTransformRule>
  ): CustomTransformRule => ({
    name,
    transform: async (content: string, context: TransformContext) => {
      const shouldExecute = await condition(context);
      return shouldExecute ? await rule.transform(content, context) : content;
    },
    ...options
  }),

  /**
   * Parallel rule execution (last one wins)
   */
  parallel: (
    name: string,
    rules: CustomTransformRule[],
    selector?: (results: string[]) => string,
    options?: Partial<CustomTransformRule>
  ): CustomTransformRule => ({
    name,
    transform: async (content: string, context: TransformContext) => {
      const results = await Promise.all(
        rules
          .filter(rule => rule.enabled !== false)
          .map(rule => rule.transform(content, context))
      );
      
      return selector ? selector(results) : results[results.length - 1];
    },
    ...options
  })
};