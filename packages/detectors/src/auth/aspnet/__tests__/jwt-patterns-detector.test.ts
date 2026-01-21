/**
 * Tests for ASP.NET JWT Patterns Detector
 */

import { describe, it, expect } from 'vitest';
import { JwtPatternsDetector } from '../jwt-patterns-detector.js';

describe('JwtPatternsDetector', () => {
  const detector = new JwtPatternsDetector();

  describe('analyzeJwtPatterns', () => {
    it('should detect JWT Bearer configuration', () => {
      const content = `
services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = Configuration["Jwt:Issuer"],
            ValidAudience = Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(key)
        };
    });
`;
      const analysis = detector.analyzeJwtPatterns(content, 'Startup.cs');
      
      expect(analysis.hasJwtConfig).toBe(true);
      expect(analysis.patterns.some(p => p.type === 'jwt-config')).toBe(true);
      expect(analysis.validationSettings).toContain('ValidateIssuer');
      expect(analysis.validationSettings).toContain('ValidateAudience');
      expect(analysis.validationSettings).toContain('ValidateLifetime');
    });

    it('should detect claims extraction', () => {
      const content = `
public class UserController : ControllerBase
{
    [HttpGet("profile")]
    public IActionResult GetProfile()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var email = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Email)?.Value;
        return Ok(new { userId, email });
    }
}
`;
      const analysis = detector.analyzeJwtPatterns(content, 'UserController.cs');
      
      expect(analysis.patterns.some(p => p.type === 'claims-extraction')).toBe(true);
      expect(analysis.claimsExtracted).toContain('NameIdentifier');
    });

    it('should detect token generation', () => {
      const content = `
public class TokenService
{
    public string GenerateToken(User user)
    {
        var claims = new[] { new Claim(ClaimTypes.Name, user.Name) };
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        
        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.Now.AddHours(1),
            signingCredentials: creds);
            
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
`;
      const analysis = detector.analyzeJwtPatterns(content, 'TokenService.cs');
      
      expect(analysis.patterns.some(p => p.type === 'token-generation')).toBe(true);
      expect(analysis.patterns.some(p => p.type === 'security-key')).toBe(true);
    });

    it('should detect security concerns - disabled validation', () => {
      const content = `
options.TokenValidationParameters = new TokenValidationParameters
{
    ValidateIssuer = false,
    ValidateAudience = false,
    ValidateLifetime = true
};
`;
      const analysis = detector.analyzeJwtPatterns(content, 'Startup.cs');
      
      expect(analysis.securityConcerns).toContain('Issuer validation disabled');
      expect(analysis.securityConcerns).toContain('Audience validation disabled');
    });
  });

  describe('detect', () => {
    it('should create violations for security concerns', async () => {
      const context = {
        content: `
options.TokenValidationParameters = new TokenValidationParameters
{
    ValidateIssuer = false,
    ValidateLifetime = false
};
`,
        file: 'Startup.cs',
        language: 'csharp' as const,
        isTestFile: false,
        isTypeDefinition: false,
      };

      const result = await detector.detect(context);
      
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some(v => v.message.includes('Issuer'))).toBe(true);
    });

    it('should return empty result for non-JWT files', async () => {
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
      expect(detector.id).toBe('auth/aspnet-jwt-patterns');
      expect(detector.category).toBe('auth');
      expect(detector.supportedLanguages).toContain('csharp');
    });
  });
});
