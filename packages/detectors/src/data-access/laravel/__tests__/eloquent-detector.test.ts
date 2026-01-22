/**
 * Laravel Eloquent Detector Tests
 */

import { describe, it, expect } from 'vitest';
import { LaravelEloquentDetector } from '../eloquent-detector.js';

describe('LaravelEloquentDetector', () => {
  const detector = new LaravelEloquentDetector();

  describe('detect', () => {
    it('should detect Eloquent model', async () => {
      const content = `
        namespace App\\Models;

        use Illuminate\\Database\\Eloquent\\Model;

        class User extends Model
        {
            protected $fillable = ['name', 'email', 'password'];
            protected $hidden = ['password', 'remember_token'];
            protected $casts = ['email_verified_at' => 'datetime'];

            public function posts()
            {
                return $this->hasMany(Post::class);
            }
        }
      `;

      const result = await detector.detect({
        content,
        file: 'app/Models/User.php',
        language: 'php',
      });

      expect(result.metadata?.custom?.laravelDataAccess).toBeDefined();
      const laravelData = result.metadata?.custom?.laravelDataAccess as { models: { models: unknown[] } };
      expect(laravelData.models.models).toHaveLength(1);
    });

    it('should detect query builder usage', async () => {
      const content = `
        namespace App\\Services;

        use App\\Models\\User;
        use Illuminate\\Support\\Facades\\DB;

        class UserService
        {
            public function getActiveUsers()
            {
                return User::where('active', true)
                    ->orderBy('created_at', 'desc')
                    ->get();
            }

            public function getRawData()
            {
                return DB::select('SELECT * FROM users WHERE active = ?', [true]);
            }
        }
      `;

      const result = await detector.detect({
        content,
        file: 'app/Services/UserService.php',
        language: 'php',
      });

      const laravelData = result.metadata?.custom?.laravelDataAccess as { queries: unknown } | undefined;
      expect(laravelData?.queries).toBeDefined();
    });

    it('should return empty for non-Eloquent code', async () => {
      const content = `
        class UserController extends Controller
        {
            public function index()
            {
                return view('users.index');
            }
        }
      `;

      const result = await detector.detect({
        content,
        file: 'UserController.php',
        language: 'php',
      });

      expect(result.patterns).toHaveLength(0);
    });
  });

  describe('metadata', () => {
    it('should have correct detector metadata', () => {
      expect(detector.id).toBe('data-access/laravel-eloquent');
      expect(detector.category).toBe('data-access');
      expect(detector.supportedLanguages).toContain('php');
    });
  });
});
