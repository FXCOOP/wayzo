/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique user identifier
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *         name:
 *           type: string
 *           description: User's display name
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Account creation date
 *         last_login:
 *           type: string
 *           format: date-time
 *           description: Last login timestamp
 *         status:
 *           type: string
 *           enum: [active, inactive, locked]
 *           description: User account status
 *         email_verified:
 *           type: boolean
 *           description: Whether email is verified
 *         preferences:
 *           type: object
 *           description: User preferences
 *     
 *     Plan:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique plan identifier
 *         destination:
 *           type: string
 *           description: Travel destination
 *         start_date:
 *           type: string
 *           format: date
 *           description: Trip start date
 *         end_date:
 *           type: string
 *           format: date
 *           description: Trip end date
 *         budget:
 *           type: number
 *           description: Total budget amount
 *         travelers:
 *           type: number
 *           description: Number of travelers
 *         is_public:
 *           type: boolean
 *           description: Whether plan is public
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Plan creation date
 *         creator_name:
 *           type: string
 *           description: Name of plan creator
 *     
 *     AuthResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Whether the operation was successful
 *         user:
 *           $ref: '#/components/schemas/User'
 *         token:
 *           type: string
 *           description: JWT authentication token
 *     
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *         code:
 *           type: string
 *           description: Error code
 *         details:
 *           type: array
 *           items:
 *             type: object
 *           description: Validation error details
 *   
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * 
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: User registration and authentication
 *   - name: Users
 *     description: User profile and management
 *   - name: Plans
 *     description: Travel plan management
 *   - name: Analytics
 *     description: Analytics and reporting
 *   - name: Admin
 *     description: Administrative functions
 * 
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     description: Create a new user account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: User's password
 *               name:
 *                 type: string
 *                 description: User's display name
 *     responses:
 *       200:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 * 
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: User login
 *     description: Authenticate user and get access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               password:
 *                 type: string
 *                 description: User's password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 * 
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Request password reset
 *     description: Send password reset email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *     responses:
 *       200:
 *         description: Password reset email sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 * 
 * @swagger
 * /api/user/profile:
 *   get:
 *     tags: [Users]
 *     summary: Get user profile
 *     description: Retrieve current user's profile information
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 * 
 * @swagger
 * /api/user/profile:
 *   put:
 *     tags: [Users]
 *     summary: Update user profile
 *     description: Update current user's profile information
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: User's display name
 *               preferences:
 *                 type: object
 *                 description: User preferences
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 * 
 * @swagger
 * /api/user/plans:
 *   get:
 *     tags: [Plans]
 *     summary: Get user's plans
 *     description: Retrieve current user's travel plans
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of plans to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of plans to skip
 *     responses:
 *       200:
 *         description: User's plans retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 plans:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Plan'
 * 
 * @swagger
 * /api/plans/public:
 *   get:
 *     tags: [Plans]
 *     summary: Get public plans
 *     description: Retrieve publicly shared travel plans
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of plans to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of plans to skip
 *     responses:
 *       200:
 *         description: Public plans retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 plans:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Plan'
 * 
 * @swagger
 * /api/plan:
 *   post:
 *     tags: [Plans]
 *     summary: Create travel plan
 *     description: Generate a new AI-powered travel plan
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - destination
 *               - start
 *               - end
 *               - budget
 *             properties:
 *               destination:
 *                 type: string
 *                 description: Travel destination
 *               start:
 *                 type: string
 *                 format: date
 *                 description: Trip start date
 *               end:
 *                 type: string
 *                 format: date
 *                 description: Trip end date
 *               budget:
 *                 type: number
 *                 description: Total budget amount
 *               adults:
 *                 type: integer
 *                 default: 2
 *                 description: Number of adults
 *               children:
 *                 type: integer
 *                 default: 0
 *                 description: Number of children
 *               level:
 *                 type: string
 *                 enum: [budget, mid, luxury]
 *                 default: mid
 *                 description: Travel style
 *               prefs:
 *                 type: string
 *                 description: Travel preferences
 *               diet:
 *                 type: string
 *                 description: Dietary restrictions
 *               currency:
 *                 type: string
 *                 default: "USD $"
 *                 description: Currency
 *     responses:
 *       200:
 *         description: Plan created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 markdown:
 *                   type: string
 *                 html:
 *                   type: string
 *                 affiliates:
 *                   type: array
 *                   items:
 *                     type: object
 * 
 * @swagger
 * /api/plan/{id}:
 *   get:
 *     tags: [Plans]
 *     summary: Get plan by ID
 *     description: Retrieve a specific travel plan
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Plan ID
 *     responses:
 *       200:
 *         description: Plan retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       404:
 *         description: Plan not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 * 
 * @swagger
 * /api/admin/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Get system statistics
 *     description: Retrieve system-wide statistics (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: object
 *                 plans:
 *                   type: object
 *                 activity:
 *                   type: object
 *                 email:
 *                   type: object
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 * 
 * @swagger
 * /api/admin/logs:
 *   get:
 *     tags: [Admin]
 *     summary: Get system logs
 *     description: Retrieve system activity logs (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of logs to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of logs to skip
 *     responses:
 *       200:
 *         description: Logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 * 
 * @swagger
 * /healthz:
 *   get:
 *     tags: [System]
 *     summary: Health check
 *     description: Check system health status
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 version:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                 environment:
 *                   type: string
 */

// API Documentation middleware
export function setupAPIDocumentation(app) {
  // Serve Swagger UI
  app.get('/api-docs', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>TripMaster AI API Documentation</title>
          <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
        </head>
        <body>
          <div id="swagger-ui"></div>
          <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
          <script>
            window.onload = function() {
              SwaggerUIBundle({
                url: '/api-docs/swagger.json',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                  SwaggerUIBundle.presets.apis,
                  SwaggerUIStandalonePreset
                ],
                plugins: [
                  SwaggerUIBundle.plugins.DownloadUrl
                ]
              });
            };
          </script>
        </body>
      </html>
    `);
  });

  // Serve Swagger JSON
  app.get('/api-docs/swagger.json', (req, res) => {
    res.json({
      openapi: '3.0.0',
      info: {
        title: 'TripMaster AI API',
        description: 'API for AI-powered travel planning platform',
        version: '1.0.0',
        contact: {
          name: 'TripMaster AI Support',
          email: 'support@tripmaster.ai'
        }
      },
      servers: [
        {
          url: process.env.BASE_URL || 'http://localhost:10000',
          description: 'Production server'
        }
      ],
      paths: {
        '/api/auth/register': {
          post: {
            tags: ['Authentication'],
            summary: 'Register a new user',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                      email: {
                        type: 'string',
                        format: 'email'
                      },
                      password: {
                        type: 'string',
                        minLength: 6
                      },
                      name: {
                        type: 'string'
                      }
                    }
                  }
                }
              }
            },
            responses: {
              200: {
                description: 'User registered successfully',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/AuthResponse'
                    }
                  }
                }
              }
            }
          }
        }
      },
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string', format: 'email' },
              name: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              last_login: { type: 'string', format: 'date-time' },
              status: { type: 'string', enum: ['active', 'inactive', 'locked'] },
              email_verified: { type: 'boolean' }
            }
          },
          AuthResponse: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              user: { $ref: '#/components/schemas/User' },
              token: { type: 'string' }
            }
          },
          Error: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' }
            }
          }
        },
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      }
    });
  });
}

// API Testing utilities
export class APITester {
  constructor(baseURL = 'http://localhost:10000') {
    this.baseURL = baseURL;
    this.token = null;
  }

  async request(method, endpoint, data = null, headers = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (this.token) {
      options.headers.Authorization = `Bearer ${this.token}`;
    }

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const responseData = await response.json();
      
      return {
        status: response.status,
        data: responseData,
        headers: response.headers
      };
    } catch (error) {
      return {
        status: 0,
        error: error.message
      };
    }
  }

  async register(email, password, name = '') {
    const response = await this.request('POST', '/api/auth/register', {
      email,
      password,
      name
    });

    if (response.status === 200 && response.data.token) {
      this.token = response.data.token;
    }

    return response;
  }

  async login(email, password) {
    const response = await this.request('POST', '/api/auth/login', {
      email,
      password
    });

    if (response.status === 200 && response.data.token) {
      this.token = response.data.token;
    }

    return response;
  }

  async getProfile() {
    return await this.request('GET', '/api/user/profile');
  }

  async createPlan(planData) {
    return await this.request('POST', '/api/plan', planData);
  }

  async getPlans() {
    return await this.request('GET', '/api/user/plans');
  }

  async getPublicPlans() {
    return await this.request('GET', '/api/plans/public');
  }

  // Run comprehensive tests
  async runTests() {
    console.log('Running API tests...');
    
    const results = {
      passed: 0,
      failed: 0,
      tests: []
    };

    // Test 1: Registration
    try {
      const testEmail = `test${Date.now()}@example.com`;
      const registerResult = await this.register(testEmail, 'password123', 'Test User');
      
      if (registerResult.status === 200) {
        results.passed++;
        results.tests.push({ name: 'User Registration', status: 'PASS' });
      } else {
        results.failed++;
        results.tests.push({ name: 'User Registration', status: 'FAIL', error: registerResult.data });
      }
    } catch (error) {
      results.failed++;
      results.tests.push({ name: 'User Registration', status: 'FAIL', error: error.message });
    }

    // Test 2: Login
    try {
      const loginResult = await this.login('test@example.com', 'password123');
      
      if (loginResult.status === 200) {
        results.passed++;
        results.tests.push({ name: 'User Login', status: 'PASS' });
      } else {
        results.failed++;
        results.tests.push({ name: 'User Login', status: 'FAIL', error: loginResult.data });
      }
    } catch (error) {
      results.failed++;
      results.tests.push({ name: 'User Login', status: 'FAIL', error: error.message });
    }

    // Test 3: Get Profile
    try {
      const profileResult = await this.getProfile();
      
      if (profileResult.status === 200) {
        results.passed++;
        results.tests.push({ name: 'Get Profile', status: 'PASS' });
      } else {
        results.failed++;
        results.tests.push({ name: 'Get Profile', status: 'FAIL', error: profileResult.data });
      }
    } catch (error) {
      results.failed++;
      results.tests.push({ name: 'Get Profile', status: 'FAIL', error: error.message });
    }

    // Test 4: Create Plan
    try {
      const planData = {
        destination: 'Paris',
        start: '2024-06-01',
        end: '2024-06-07',
        budget: 3000,
        adults: 2,
        children: 0,
        level: 'mid'
      };
      
      const planResult = await this.createPlan(planData);
      
      if (planResult.status === 200) {
        results.passed++;
        results.tests.push({ name: 'Create Plan', status: 'PASS' });
      } else {
        results.failed++;
        results.tests.push({ name: 'Create Plan', status: 'FAIL', error: planResult.data });
      }
    } catch (error) {
      results.failed++;
      results.tests.push({ name: 'Create Plan', status: 'FAIL', error: error.message });
    }

    // Test 5: Get Plans
    try {
      const plansResult = await this.getPlans();
      
      if (plansResult.status === 200) {
        results.passed++;
        results.tests.push({ name: 'Get Plans', status: 'PASS' });
      } else {
        results.failed++;
        results.tests.push({ name: 'Get Plans', status: 'FAIL', error: plansResult.data });
      }
    } catch (error) {
      results.failed++;
      results.tests.push({ name: 'Get Plans', status: 'FAIL', error: error.message });
    }

    console.log(`Tests completed: ${results.passed} passed, ${results.failed} failed`);
    console.log('Test results:', results.tests);
    
    return results;
  }
}

export default setupAPIDocumentation;