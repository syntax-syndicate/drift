/**
 * ASP.NET Core Endpoint Detector Tests
 */

import { describe, it, expect } from 'vitest';
import { AspNetEndpointDetector, extractAspNetEndpoints } from '../aspnet-endpoint-detector.js';

describe('AspNetEndpointDetector', () => {
  describe('controller detection', () => {
    it('should extract endpoints from basic controller', () => {
      const content = `
using Microsoft.AspNetCore.Mvc;

namespace MyApp.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    [HttpGet]
    public ActionResult<List<UserDto>> GetAll()
    {
        return Ok(new List<UserDto>());
    }

    [HttpGet("{id}")]
    public ActionResult<UserDto> GetById(int id)
    {
        return Ok(new UserDto());
    }

    [HttpPost]
    public ActionResult<UserDto> Create([FromBody] CreateUserDto dto)
    {
        return Created("", new UserDto());
    }
}

public record UserDto(int Id, string Name, string Email);
public record CreateUserDto(string Name, string Email);
`;

      const result = extractAspNetEndpoints(content, 'UsersController.cs');
      
      expect(result.framework).toBe('aspnet-core');
      expect(result.endpoints).toHaveLength(3);
      expect(result.controllers).toHaveLength(1);
      expect(result.controllers[0]?.name).toBe('UsersController');
      
      // GET /api/users
      const getAll = result.endpoints.find(e => e.method === 'GET' && !e.path.includes('{'));
      expect(getAll).toBeDefined();
      expect(getAll?.normalizedPath).toMatch(/\/api\/users/i);
      
      // GET /api/users/{id}
      const getById = result.endpoints.find(e => e.method === 'GET' && e.path.includes('{'));
      expect(getById).toBeDefined();
      expect(getById?.normalizedPath).toContain(':id');
      
      // POST /api/users
      const create = result.endpoints.find(e => e.method === 'POST');
      expect(create).toBeDefined();
    });

    it('should extract authorization attributes', () => {
      const content = `
[ApiController]
[Route("api/[controller]")]
public class AdminController : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public ActionResult GetSecure()
    {
        return Ok();
    }

    [HttpGet("public")]
    [AllowAnonymous]
    public ActionResult GetPublic()
    {
        return Ok();
    }

    [HttpPost]
    [Authorize(Policy = "RequireAdminRole")]
    public ActionResult CreateItem()
    {
        return Ok();
    }
}
`;

      const result = extractAspNetEndpoints(content, 'AdminController.cs');
      
      expect(result.endpoints).toHaveLength(3);
      
      // Check Authorize with Roles
      const secureEndpoint = result.endpoints.find(e => e.action === 'GetSecure');
      expect(secureEndpoint?.authorization).toHaveLength(1);
      expect(secureEndpoint?.authorization[0]?.name).toBe('Authorize');
      expect(secureEndpoint?.authorization[0]?.roles).toContain('Admin');
      expect(secureEndpoint?.authorization[0]?.roles).toContain('SuperAdmin');
      
      // Check AllowAnonymous
      const publicEndpoint = result.endpoints.find(e => e.action === 'GetPublic');
      expect(publicEndpoint?.authorization).toHaveLength(1);
      expect(publicEndpoint?.authorization[0]?.name).toBe('AllowAnonymous');
      
      // Check Authorize with Policy
      const policyEndpoint = result.endpoints.find(e => e.action === 'CreateItem');
      expect(policyEndpoint?.authorization[0]?.policy).toBe('RequireAdminRole');
    });

    it('should extract request body fields from DTO', () => {
      const content = `
[ApiController]
[Route("api/orders")]
public class OrdersController : ControllerBase
{
    [HttpPost]
    public ActionResult<OrderDto> Create([FromBody] CreateOrderDto dto)
    {
        return Created("", new OrderDto());
    }
}

public class CreateOrderDto
{
    public string ProductName { get; set; }
    public int Quantity { get; set; }
    public decimal Price { get; set; }
    public string? Notes { get; set; }
}

public class OrderDto
{
    public int Id { get; set; }
    public string ProductName { get; set; }
    public int Quantity { get; set; }
    public decimal Price { get; set; }
}
`;

      const result = extractAspNetEndpoints(content, 'OrdersController.cs');
      
      expect(result.endpoints).toHaveLength(1);
      const endpoint = result.endpoints[0]!;
      
      // Check request fields
      expect(endpoint.requestFields.length).toBeGreaterThan(0);
      expect(endpoint.requestFields.some(f => f.name === 'ProductName')).toBe(true);
      expect(endpoint.requestFields.some(f => f.name === 'Quantity')).toBe(true);
      expect(endpoint.requestFields.some(f => f.name === 'Price')).toBe(true);
    });

    it('should extract fields from record types', () => {
      const content = `
[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    [HttpPost]
    public ActionResult<ProductDto> Create([FromBody] CreateProductDto dto)
    {
        return Created("", new ProductDto(1, dto.Name, dto.Price));
    }
}

public record CreateProductDto(string Name, decimal Price, string? Description = null);
public record ProductDto(int Id, string Name, decimal Price);
`;

      const result = extractAspNetEndpoints(content, 'ProductsController.cs');
      
      expect(result.endpoints).toHaveLength(1);
      const endpoint = result.endpoints[0]!;
      
      // Check request fields from record
      expect(endpoint.requestFields.some(f => f.name === 'Name')).toBe(true);
      expect(endpoint.requestFields.some(f => f.name === 'Price')).toBe(true);
    });

    it('should handle custom route templates', () => {
      const content = `
[ApiController]
[Route("api/v1/[controller]")]
public class ItemsController : ControllerBase
{
    [HttpGet("all")]
    public ActionResult GetAll() => Ok();

    [HttpGet("{id:int}")]
    public ActionResult GetById(int id) => Ok();

    [HttpGet("search/{query}")]
    public ActionResult Search(string query) => Ok();
}
`;

      const result = extractAspNetEndpoints(content, 'ItemsController.cs');
      
      expect(result.endpoints).toHaveLength(3);
      
      const getAllEndpoint = result.endpoints.find(e => e.path.includes('all'));
      expect(getAllEndpoint?.normalizedPath).toContain('/api/v1/items/all');
      
      const getByIdEndpoint = result.endpoints.find(e => e.path.includes('{id'));
      expect(getByIdEndpoint?.normalizedPath).toContain(':id');
      
      const searchEndpoint = result.endpoints.find(e => e.path.includes('search'));
      expect(searchEndpoint?.normalizedPath).toContain(':query');
    });
  });

  describe('minimal API detection', () => {
    it('should extract endpoints from minimal API style', () => {
      const content = `
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/api/users", () => Results.Ok(new List<User>()));
app.MapGet("/api/users/{id}", (int id) => Results.Ok(new User()));
app.MapPost("/api/users", (CreateUserDto dto) => Results.Created("/api/users/1", new User()));
app.MapPut("/api/users/{id}", (int id, UpdateUserDto dto) => Results.Ok());
app.MapDelete("/api/users/{id}", (int id) => Results.NoContent());

app.Run();
`;

      const result = extractAspNetEndpoints(content, 'Program.cs');
      
      expect(result.framework).toBe('aspnet-minimal');
      expect(result.endpoints).toHaveLength(5);
      
      expect(result.endpoints.filter(e => e.method === 'GET')).toHaveLength(2);
      expect(result.endpoints.filter(e => e.method === 'POST')).toHaveLength(1);
      expect(result.endpoints.filter(e => e.method === 'PUT')).toHaveLength(1);
      expect(result.endpoints.filter(e => e.method === 'DELETE')).toHaveLength(1);
    });
  });

  describe('type mapping', () => {
    it('should map C# types to generic types', () => {
      const content = `
[ApiController]
[Route("api/data")]
public class DataController : ControllerBase
{
    [HttpGet]
    public ActionResult<DataDto> Get() => Ok(new DataDto());
}

public class DataDto
{
    public string Name { get; set; }
    public int Count { get; set; }
    public decimal Price { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public Guid Id { get; set; }
    public List<string> Tags { get; set; }
}
`;

      const result = extractAspNetEndpoints(content, 'DataController.cs');
      const endpoint = result.endpoints[0]!;
      
      const findField = (name: string) => endpoint.responseFields.find(f => f.name === name);
      
      expect(findField('Name')?.type).toBe('string');
      expect(findField('Count')?.type).toBe('number');
      expect(findField('Price')?.type).toBe('number');
      expect(findField('IsActive')?.type).toBe('boolean');
      expect(findField('CreatedAt')?.type).toBe('string');
      expect(findField('Id')?.type).toBe('string');
      expect(findField('Tags')?.type).toBe('array');
    });
  });

  describe('detector class', () => {
    it('should have correct metadata', () => {
      const detector = new AspNetEndpointDetector();
      
      expect(detector.id).toBe('contracts/aspnet-endpoints');
      expect(detector.category).toBe('api');
      expect(detector.supportedLanguages).toContain('csharp');
    });

    it('should return empty result for non-controller files', async () => {
      const detector = new AspNetEndpointDetector();
      
      const result = await detector.detect({
        content: 'public class SomeService { }',
        file: 'SomeService.cs',
        language: 'csharp',
        isTestFile: false,
        isTypeDefinition: false,
      });
      
      expect(result.patterns).toHaveLength(0);
    });
  });
});
