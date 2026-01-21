/**
 * Tests for ASP.NET Policy Handlers Detector
 */

import { describe, it, expect } from 'vitest';
import { PolicyHandlersDetector } from '../policy-handlers-detector.js';

describe('PolicyHandlersDetector', () => {
  const detector = new PolicyHandlersDetector();

  describe('analyzePolicyHandlers', () => {
    it('should detect IAuthorizationHandler implementation', () => {
      const content = `
public class MinimumAgeHandler : AuthorizationHandler<MinimumAgeRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        MinimumAgeRequirement requirement)
    {
        var dateOfBirthClaim = context.User.FindFirst(c => c.Type == "DateOfBirth");
        if (dateOfBirthClaim != null)
        {
            var dateOfBirth = DateTime.Parse(dateOfBirthClaim.Value);
            var age = DateTime.Today.Year - dateOfBirth.Year;
            if (age >= requirement.MinimumAge)
            {
                context.Succeed(requirement);
            }
        }
        return Task.CompletedTask;
    }
}
`;
      const analysis = detector.analyzePolicyHandlers(content, 'MinimumAgeHandler.cs');
      
      expect(analysis.handlers.some(h => h.type === 'handler')).toBe(true);
      expect(analysis.requirements).toContain('MinimumAgeRequirement');
    });

    it('should detect IAuthorizationRequirement implementation', () => {
      const content = `
public class MinimumAgeRequirement : IAuthorizationRequirement
{
    public int MinimumAge { get; }

    public MinimumAgeRequirement(int minimumAge)
    {
        MinimumAge = minimumAge;
    }
}
`;
      const analysis = detector.analyzePolicyHandlers(content, 'MinimumAgeRequirement.cs');
      
      expect(analysis.handlers.some(h => h.type === 'requirement')).toBe(true);
      expect(analysis.requirements).toContain('MinimumAgeRequirement');
    });

    it('should detect policy registration', () => {
      const content = `
services.AddAuthorization(options =>
{
    options.AddPolicy("AtLeast21", policy =>
        policy.Requirements.Add(new MinimumAgeRequirement(21)));
    
    options.AddPolicy("AdminOnly", policy =>
        policy.RequireRole("Admin"));
    
    options.AddPolicy("CanEditDocument", policy =>
        policy.RequireClaim("Permission", "Edit"));
});
`;
      const analysis = detector.analyzePolicyHandlers(content, 'Startup.cs');
      
      expect(analysis.usesPolicyAuth).toBe(true);
      expect(analysis.policyNames).toContain('AtLeast21');
      expect(analysis.policyNames).toContain('AdminOnly');
      expect(analysis.policyNames).toContain('CanEditDocument');
      expect(analysis.handlers.some(h => h.name === 'RequireRole')).toBe(true);
      expect(analysis.handlers.some(h => h.name === 'RequireClaim')).toBe(true);
    });

    it('should detect RequireAuthenticatedUser', () => {
      const content = `
options.AddPolicy("Authenticated", policy =>
    policy.RequireAuthenticatedUser());
`;
      const analysis = detector.analyzePolicyHandlers(content, 'Startup.cs');
      
      expect(analysis.handlers.some(h => h.name === 'RequireAuthenticatedUser')).toBe(true);
    });
  });

  describe('detect', () => {
    it('should return patterns for policy handlers', async () => {
      const context = {
        content: `
public class DocumentRequirement : IAuthorizationRequirement
{
    public string Permission { get; }
}

public class DocumentHandler : AuthorizationHandler<DocumentRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        DocumentRequirement requirement)
    {
        return Task.CompletedTask;
    }
}
`,
        file: 'DocumentHandler.cs',
        language: 'csharp' as const,
        isTestFile: false,
        isTypeDefinition: false,
      };

      const result = await detector.detect(context);
      
      expect(result.patterns.length).toBeGreaterThan(0);
    });

    it('should return empty result for non-policy files', async () => {
      const context = {
        content: `
public class ProductService
{
    public Product GetProduct(int id) => new Product();
}
`,
        file: 'ProductService.cs',
        language: 'csharp' as const,
        isTestFile: false,
        isTypeDefinition: false,
      };

      const result = await detector.detect(context);
      
      expect(result.patterns).toHaveLength(0);
    });
  });

  describe('metadata', () => {
    it('should have correct detector metadata', () => {
      expect(detector.id).toBe('auth/aspnet-policy-handlers');
      expect(detector.category).toBe('auth');
      expect(detector.supportedLanguages).toContain('csharp');
    });
  });
});
