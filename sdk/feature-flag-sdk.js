/**
 * Feature Flag SDK for JavaScript
 */
class FeatureFlagClient {
  constructor(options) {
    this.baseUrl = options.baseUrl || 'http://localhost:8000';
    this.apiKey = options.apiKey || 'test-api-key';
    this.environment = options.environment || 'prod';
    this.context = options.context || {};
    this.cache = new Map();
    this.cacheTime = options.cacheTime || 60000; // Default cache time: 1 minute
    this.enableLocalEvaluation = options.enableLocalEvaluation || false;
    this.localFlags = null;
    
    // Initialize with cached flags if local evaluation is enabled
    if (this.enableLocalEvaluation) {
      this.refreshLocalFlags();
      // Set up a timer to refresh flags periodically
      setInterval(() => this.refreshLocalFlags(), this.cacheTime);
    }
  }

  /**
   * Set the user context for flag evaluation
   */
  setContext(context) {
    this.context = { ...this.context, ...context };
    // Clear cache when context changes
    this.cache.clear();
  }

  /**
   * Refresh local flags for client-side evaluation
   */
  async refreshLocalFlags() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/client/${this.environment}`, {
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching flags: ${response.status}`);
      }
      
      const data = await response.json();
      this.localFlags = data.flags;
      console.log('Local flags refreshed');
    } catch (error) {
      console.error('Failed to refresh local flags:', error);
    }
  }

  /**
   * Get the value of a feature flag
   */
  async getBooleanValue(flagKey, defaultValue = false) {
    try {
      const result = await this.evaluateFlag(flagKey);
      return typeof result.value === 'boolean' ? result.value : defaultValue;
    } catch (error) {
      console.error(`Error getting flag ${flagKey}:`, error);
      return defaultValue;
    }
  }

  /**
   * Get a string value
   */
  async getStringValue(flagKey, defaultValue = '') {
    try {
      const result = await this.evaluateFlag(flagKey);
      return typeof result.value === 'string' ? result.value : defaultValue;
    } catch (error) {
      console.error(`Error getting flag ${flagKey}:`, error);
      return defaultValue;
    }
  }

  /**
   * Get a number value
   */
  async getNumberValue(flagKey, defaultValue = 0) {
    try {
      const result = await this.evaluateFlag(flagKey);
      return typeof result.value === 'number' ? result.value : defaultValue;
    } catch (error) {
      console.error(`Error getting flag ${flagKey}:`, error);
      return defaultValue;
    }
  }

  /**
   * Get a JSON value
   */
  async getJsonValue(flagKey, defaultValue = {}) {
    try {
      const result = await this.evaluateFlag(flagKey);
      return result.value !== null && typeof result.value === 'object' ? result.value : defaultValue;
    } catch (error) {
      console.error(`Error getting flag ${flagKey}:`, error);
      return defaultValue;
    }
  }

  /**
   * Evaluate a feature flag
   */
  async evaluateFlag(flagKey) {
    // Check cache first
    const cacheKey = `${flagKey}-${JSON.stringify(this.context)}`;
    const cachedResult = this.cache.get(cacheKey);
    
    if (cachedResult && cachedResult.timestamp > Date.now() - this.cacheTime) {
      return cachedResult.value;
    }
    
    // Try local evaluation if enabled
    if (this.enableLocalEvaluation && this.localFlags) {
      const localResult = this.evaluateFlagLocally(flagKey);
      if (localResult) {
        this.cache.set(cacheKey, {
          value: localResult,
          timestamp: Date.now()
        });
        return localResult;
      }
    }
    
    // Fall back to server evaluation
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/flags/${flagKey}/evaluate`, {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: this.context.userId,
          session_id: this.context.sessionId,
          attributes: this.context.attributes || {}
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error evaluating flag: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Cache the result
      this.cache.set(cacheKey, {
        value: result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      console.error('Error evaluating flag:', error);
      throw error;
    }
  }

  /**
   * Evaluate a flag locally (simple implementation)
   */
  evaluateFlagLocally(flagKey) {
    // Find the flag
    const flag = this.localFlags.find(f => f.key === flagKey);
    if (!flag || !flag.enabled) {
      return null;
    }
    
    // Find the default variation
    let selectedVariation = flag.variations.find(v => v.id === flag.default_variation_id);
    if (!selectedVariation && flag.variations.length > 0) {
      selectedVariation = flag.variations[0];
    }
    
    let reason = 'DEFAULT_RULE';
    
    // Check rules (simplified implementation)
    if (flag.rules && flag.rules.length > 0) {
      for (const rule of flag.rules) {
        if (this.evaluateRuleLocally(rule)) {
          const ruleVariation = flag.variations.find(v => v.id === rule.variation_id);
          if (ruleVariation) {
            selectedVariation = ruleVariation;
            reason = `RULE_MATCH:${rule.id || 'unknown'}`;
            break;
          }
        }
      }
    }
    
    if (!selectedVariation) {
      return null;
    }
    
    return {
      flag_key: flagKey,
      variation_id: selectedVariation.id,
      value: selectedVariation.value.value,
      reason
    };
  }

  /**
   * Evaluate a rule locally (simplified)
   */
  evaluateRuleLocally(rule) {
    if (rule.type === 'user' && rule.user_ids && this.context.userId) {
      return rule.user_ids.includes(this.context.userId);
    }
    
    if (rule.type === 'attribute' && rule.attribute && rule.operator && this.context.attributes) {
      const userValue = this.context.attributes[rule.attribute];
      
      if (rule.operator === 'equals') {
        return userValue === rule.value;
      }
      if (rule.operator === 'contains' && typeof userValue === 'string') {
        return userValue.includes(rule.value);
      }
      if (rule.operator === 'greater_than' && typeof userValue === 'number') {
        return userValue > rule.value;
      }
      if (rule.operator === 'less_than' && typeof userValue === 'number') {
        return userValue < rule.value;
      }
    }
    
    return false;
  }
}

// Example usage
// const client = new FeatureFlagClient({
//   baseUrl: 'http://localhost:8000',
//   apiKey: 'test-api-key',
//   context: {
//     userId: 'user-123',
//     attributes: {
//       loyalty_tier: 'gold'
//     }
//   }
// });
// 
// // Check a boolean flag
// client.getBooleanValue('new-checkout').then(value => {
//   if (value) {
//     // Show new checkout
//   } else {
//     // Show old checkout
//   }
// });
// 
// // Get a number value
// client.getNumberValue('discount-percentage').then(discount => {
//   applyDiscount(discount);
// });
