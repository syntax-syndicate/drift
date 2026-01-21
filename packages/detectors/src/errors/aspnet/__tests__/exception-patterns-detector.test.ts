/**
 * Tests for ASP.NET Exception Patterns Detector
 */

import { describe, it, expect } from 'vitest';
import { ExceptionPatternsDetector } from '../exception-patterns-detector.js';

describe('ExceptionPatternsDetector', () => {
  const detector = new ExceptionPatternsDetector();

  describe('analyzeExceptionPatterns', () => {
    it('should detect custom exception classes', () => {
      const content = `
public class NotFoundException : Exception
{
    public NotFoundException(string message) : base(message) { }
    public NotFoundException(string message, Exception inner) : base(message, inner) { }
}

public class ValidationException : Exception
{
    public IEnumerable<string> Errors { get; }
    public ValidationException(IEnumerable<string> errors) : base("Validation failed")
    {
        Errors = errors;
    }
}
`;
      const analysis = detector.analyzeExceptionPatterns(content, 'Exceptions.cs');
      
      expect(analysis.customExceptions).toContain('NotFoundException');
      expect(analysis.customExceptions).toContain('ValidationException');
      expect(analysis.patterns.filter(p => p.type === 'custom-exception')).toHaveLength(2);
    });

    it('should detect IExceptionHandler implementation', () => {
      const content = `
public class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        _logger.LogError(exception, "An error occurred");
        
        httpContext.Response.StatusCode = 500;
        await httpContext.Response.WriteAsJsonAsync(new { error = "An error occurred" });
        
        return true;
    }
}
`;
      const analysis = detector.analyzeExceptionPatterns(content, 'GlobalExceptionHandler.cs');
      
      expect(analysis.hasGlobalHandler).toBe(true);
      expect(analysis.handlers).toContain('GlobalExceptionHandler');
      expect(analysis.patterns.some(p => p.type === 'exception-handler')).toBe(true);
    });

    it('should detect UseExceptionHandler middleware', () => {
      const content = `
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        context.Response.StatusCode = 500;
        await context.Response.WriteAsync("An error occurred");
    });
});
`;
      const analysis = detector.analyzeExceptionPatterns(content, 'Program.cs');
      
      expect(analysis.hasGlobalHandler).toBe(true);
      expect(analysis.patterns.some(p => p.type === 'exception-middleware')).toBe(true);
    });

    it('should detect exception filters', () => {
      const content = `
public class ApiExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        context.Result = new ObjectResult(new { error = context.Exception.Message })
        {
            StatusCode = 500
        };
        context.ExceptionHandled = true;
    }
}
`;
      const analysis = detector.analyzeExceptionPatterns(content, 'ApiExceptionFilter.cs');
      
      expect(analysis.handlers).toContain('ApiExceptionFilter');
      expect(analysis.patterns.some(p => p.type === 'exception-filter')).toBe(true);
    });

    it('should detect ProblemDetails usage', () => {
      const content = `
public IActionResult HandleError()
{
    var problemDetails = new ProblemDetails
    {
        Status = 500,
        Title = "An error occurred",
        Detail = "Please try again later"
    };
    return new ObjectResult(problemDetails);
}
`;
      const analysis = detector.analyzeExceptionPatterns(content, 'ErrorController.cs');
      
      expect(analysis.usesProblemDetails).toBe(true);
      expect(analysis.patterns.some(p => p.type === 'problem-details')).toBe(true);
    });

    it('should detect empty catch blocks as issues', () => {
      const content = `
try
{
    DoSomething();
}
catch
{
}
`;
      const analysis = detector.analyzeExceptionPatterns(content, 'Service.cs');
      
      expect(analysis.issues.length).toBeGreaterThan(0);
      expect(analysis.issues[0]).toContain('Empty catch');
    });
  });

  describe('detect', () => {
    it('should create violations for empty catch blocks', async () => {
      const context = {
        content: `
public void Process()
{
    try
    {
        DoWork();
    }
    catch { }
}
`,
        file: 'Service.cs',
        language: 'csharp' as const,
        isTestFile: false,
        isTypeDefinition: false,
      };

      const result = await detector.detect(context);
      
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('metadata', () => {
    it('should have correct detector metadata', () => {
      expect(detector.id).toBe('errors/aspnet-exception-patterns');
      expect(detector.category).toBe('errors');
      expect(detector.supportedLanguages).toContain('csharp');
    });
  });
});
