/**
 * Tests for ASP.NET Identity Patterns Detector
 */

import { describe, it, expect } from 'vitest';
import { IdentityPatternsDetector } from '../identity-patterns-detector.js';

describe('IdentityPatternsDetector', () => {
  const detector = new IdentityPatternsDetector();

  describe('analyzeIdentityUsage', () => {
    it('should detect UserManager<T> usage', () => {
      const content = `
using Microsoft.AspNetCore.Identity;

public class AccountService
{
    private readonly UserManager<ApplicationUser> _userManager;

    public AccountService(UserManager<ApplicationUser> userManager)
    {
        _userManager = userManager;
    }

    public async Task<IdentityResult> CreateUser(string email, string password)
    {
        var user = new ApplicationUser { Email = email, UserName = email };
        return await _userManager.CreateAsync(user, password);
    }
}
`;
      const analysis = detector.analyzeIdentityUsage(content, 'AccountService.cs');
      
      expect(analysis.usages.length).toBeGreaterThan(0);
      expect(analysis.usages.some(u => u.type === 'user-manager')).toBe(true);
      expect(analysis.customUserType).toBe('ApplicationUser');
      // Method detection happens on lines with both UserManager and method call
    });

    it('should detect SignInManager<T> usage', () => {
      const content = `
public class LoginController : Controller
{
    private readonly SignInManager<ApplicationUser> _signInManager;

    public async Task<IActionResult> Login(LoginModel model)
    {
        var result = await _signInManager.PasswordSignInAsync(
            model.Email, model.Password, model.RememberMe, lockoutOnFailure: true);
        return result.Succeeded ? RedirectToAction("Index") : View(model);
    }
}
`;
      const analysis = detector.analyzeIdentityUsage(content, 'LoginController.cs');
      
      expect(analysis.usages.some(u => u.type === 'signin-manager')).toBe(true);
      // Method detection happens on lines with both SignInManager and method call
    });

    it('should detect RoleManager<T> usage', () => {
      const content = `
public class RoleService
{
    private readonly RoleManager<IdentityRole> _roleManager;

    public async Task CreateRole(string roleName)
    {
        await _roleManager.CreateAsync(new IdentityRole(roleName));
    }
}
`;
      const analysis = detector.analyzeIdentityUsage(content, 'RoleService.cs');
      
      expect(analysis.usages.some(u => u.type === 'role-manager')).toBe(true);
    });

    it('should detect custom IdentityUser', () => {
      const content = `
public class ApplicationUser : IdentityUser
{
    public string FirstName { get; set; }
    public string LastName { get; set; }
    public DateTime DateOfBirth { get; set; }
}
`;
      const analysis = detector.analyzeIdentityUsage(content, 'ApplicationUser.cs');
      
      expect(analysis.usages.some(u => u.type === 'identity-user')).toBe(true);
      expect(analysis.customUserType).toBe('ApplicationUser');
    });

    it('should detect custom user stores', () => {
      const content = `
public class CustomUserStore : IUserStore<ApplicationUser>
{
    public Task<IdentityResult> CreateAsync(ApplicationUser user, CancellationToken ct)
    {
        // Custom implementation
    }
}
`;
      const analysis = detector.analyzeIdentityUsage(content, 'CustomUserStore.cs');
      
      expect(analysis.usages.some(u => u.type === 'user-store')).toBe(true);
      expect(analysis.hasCustomStores).toBe(true);
    });
  });

  describe('detect', () => {
    it('should return patterns for identity usage', async () => {
      const context = {
        content: `
public class AccountService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
}
`,
        file: 'AccountService.cs',
        language: 'csharp' as const,
        isTestFile: false,
        isTypeDefinition: false,
      };

      const result = await detector.detect(context);
      
      expect(result.patterns.length).toBeGreaterThan(0);
    });

    it('should return empty result for non-identity files', async () => {
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
      expect(detector.id).toBe('auth/aspnet-identity-patterns');
      expect(detector.category).toBe('auth');
      expect(detector.supportedLanguages).toContain('csharp');
    });
  });
});
