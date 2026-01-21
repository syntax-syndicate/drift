/**
 * Tests for ASP.NET Resource Authorization Detector
 */

import { describe, it, expect } from 'vitest';
import { ResourceAuthorizationDetector } from '../resource-authorization-detector.js';

describe('ResourceAuthorizationDetector', () => {
  const detector = new ResourceAuthorizationDetector();

  describe('analyzeResourceAuth', () => {
    it('should detect IAuthorizationService usage', () => {
      const content = `
public class DocumentController : ControllerBase
{
    private readonly IAuthorizationService _authorizationService;

    public DocumentController(IAuthorizationService authorizationService)
    {
        _authorizationService = authorizationService;
    }
}
`;
      const analysis = detector.analyzeResourceAuth(content, 'DocumentController.cs');
      
      expect(analysis.usesAuthorizationService).toBe(true);
      expect(analysis.patterns.some(p => p.type === 'authorization-service')).toBe(true);
    });

    it('should detect AuthorizeAsync calls', () => {
      const content = `
public async Task<IActionResult> Edit(int id)
{
    var document = await _documentService.GetAsync(id);
    var authResult = await _authorizationService.AuthorizeAsync(User, document, "EditPolicy");
    
    if (!authResult.Succeeded)
    {
        return Forbid();
    }
    
    return View(document);
}
`;
      const analysis = detector.analyzeResourceAuth(content, 'DocumentController.cs');
      
      expect(analysis.patterns.some(p => p.type === 'resource-check')).toBe(true);
    });

    it('should detect ownership checks', () => {
      const content = `
public async Task<IActionResult> Edit(int id)
{
    var document = await _context.Documents.FindAsync(id);
    var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    
    if (document.OwnerId != userId)
    {
        return Forbid();
    }
    
    return View(document);
}
`;
      const analysis = detector.analyzeResourceAuth(content, 'DocumentController.cs');
      
      expect(analysis.patterns.some(p => p.type === 'ownership-check')).toBe(true);
    });

    it('should detect document-level authorization in queries', () => {
      const content = `
public async Task<List<Document>> GetUserDocuments()
{
    var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    return await _context.Documents
        .Where(d => d.UserId == userId)
        .ToListAsync();
}
`;
      const analysis = detector.analyzeResourceAuth(content, 'DocumentService.cs');
      
      expect(analysis.patterns.some(p => p.type === 'document-auth')).toBe(true);
    });

    it('should detect tenant scoping', () => {
      const content = `
public async Task<List<Order>> GetOrders()
{
    var tenantId = User.FindFirst("TenantId")?.Value;
    return await _context.Orders
        .Where(o => o.TenantId == tenantId)
        .ToListAsync();
}
`;
      const analysis = detector.analyzeResourceAuth(content, 'OrderService.cs');
      
      expect(analysis.patterns.some(p => p.type === 'document-auth')).toBe(true);
    });
  });

  describe('detect', () => {
    it('should return patterns for resource authorization', async () => {
      const context = {
        content: `
public class DocumentController : ControllerBase
{
    private readonly IAuthorizationService _authorizationService;

    public async Task<IActionResult> Delete(int id)
    {
        var doc = await _repo.GetAsync(id);
        var result = await _authorizationService.AuthorizeAsync(User, doc, "DeletePolicy");
        if (!result.Succeeded) return Forbid();
        return Ok();
    }
}
`,
        file: 'DocumentController.cs',
        language: 'csharp' as const,
        isTestFile: false,
        isTypeDefinition: false,
      };

      const result = await detector.detect(context);
      
      expect(result.patterns.length).toBeGreaterThan(0);
    });

    it('should return empty result for non-auth files', async () => {
      const context = {
        content: `
public class MathService
{
    public int Add(int a, int b) => a + b;
}
`,
        file: 'MathService.cs',
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
      expect(detector.id).toBe('auth/aspnet-resource-authorization');
      expect(detector.category).toBe('auth');
      expect(detector.supportedLanguages).toContain('csharp');
    });
  });
});
