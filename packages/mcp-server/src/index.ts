import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { searchEntities, query as dbQuery } from '@webdex/database';
import { initEmbeddingModel, generateEmbedding } from '@webdex/interpreter';

const server = new Server(
  { name: 'webdex', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

let embeddingReady = false;

async function getEmbedding(text: string): Promise<number[] | undefined> {
  try {
    if (!embeddingReady) {
      await initEmbeddingModel();
      embeddingReady = true;
    }
    return await generateEmbedding(text);
  } catch {
    return undefined;
  }
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'webdex_search',
      description: 'Semantically search the WebDex entity index. Returns structured data about businesses, contacts, products, and actions. Supports natural language queries with vector similarity search.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Natural language search query' },
          category: {
            type: 'string',
            enum: ['contact', 'organisation', 'product', 'action', 'location', 'event', 'review'],
            description: 'Filter by entity category',
          },
          domain: { type: 'string', description: 'Filter by domain (e.g. regenpower.com)' },
          limit: { type: 'number', description: 'Max results (default 10)', default: 10 },
        },
        required: ['query'],
      },
    },
    {
      name: 'webdex_get_form',
      description: 'Get the complete form schema for an action entity — all fields, types, validation, and the submission endpoint. Use before webdex_submit_form.',
      inputSchema: {
        type: 'object',
        properties: {
          action_id: { type: 'string', description: 'The action entity ID from a webdex_search result' },
        },
        required: ['action_id'],
      },
    },
    {
      name: 'webdex_submit_form',
      description: 'Submit a form using a pre-mapped WebDex action entity. Untrusted actions return an approval_token that a human must confirm before execution. Trusted actions (2+ prior approved successes) execute hands-free. Call webdex_get_form first to understand required fields.',
      inputSchema: {
        type: 'object',
        properties: {
          action_id: { type: 'string', description: 'The action entity ID' },
          data: { type: 'object', description: 'Form field values as key-value pairs' },
          approval_token: { type: 'string', description: 'Optional — provide to execute a previously approved submission' },
        },
        required: ['action_id', 'data'],
      },
    },
    {
      name: 'webdex_check_action_trust',
      description: 'Check the trust level of an action. Returns whether it can execute hands-free or still requires human approval.',
      inputSchema: {
        type: 'object',
        properties: {
          action_id: { type: 'string', description: 'The action entity ID' },
        },
        required: ['action_id'],
      },
    },
    {
      name: 'webdex_assemble',
      description: 'Assemble and return structured data across multiple entity categories. Use for building comparison tables, lead lists, or comprehensive datasets about a domain or location.',
      inputSchema: {
        type: 'object',
        properties: {
          categories: { type: 'array', items: { type: 'string' }, description: 'Entity categories to include' },
          domain: { type: 'string', description: 'Filter by domain' },
          location: { type: 'string', description: 'Filter by location keyword in searchable text' },
          limit: { type: 'number', description: 'Max results per category (default 50)', default: 50 },
        },
      },
    },
    {
      name: 'webdex_compare',
      description: 'Compare multiple entities side by side. Returns structured comparison data for products, organisations, or services.',
      inputSchema: {
        type: 'object',
        properties: {
          entity_ids: { type: 'array', items: { type: 'string' }, description: 'Array of entity IDs to compare (from webdex_search results)' },
        },
        required: ['entity_ids'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {

      case 'webdex_search': {
        const q = String((args as any).query || '');
        const embedding = await getEmbedding(q);
        const results = await searchEntities({
          query: q,
          category: (args as any).category,
          domain: (args as any).domain,
          embedding,
          limit: (args as any).limit || 10,
        });

        // Return clean, agent-friendly output
        const clean = results.map((r: any) => ({
          id: r.id,
          category: r.category,
          domain: r.domain,
          data: r.data,
          aieo_score: r.aieo_score,
          confidence: r.confidence,
          vector_similarity: r.vector_similarity ?? null,
        }));

        return { content: [{ type: 'text', text: JSON.stringify({ total: clean.length, results: clean }, null, 2) }] };
      }

      case 'webdex_get_form': {
        const result = await dbQuery(
          "SELECT id, domain, data, confidence, aieo_score FROM entities WHERE id = $1 AND category = 'action'",
          [(args as any).action_id]
        );
        if (result.rows.length === 0) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: 'Action not found', action_id: (args as any).action_id }) }] };
        }
        const action = result.rows[0];
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              id: action.id,
              domain: action.domain,
              type: action.data.type,
              purpose: action.data.purpose,
              endpoint: action.data.endpoint,
              method: action.data.method || 'POST',
              contentType: action.data.contentType || 'application/x-www-form-urlencoded',
              fields: action.data.fields || [],
              hiddenFields: action.data.hiddenFields || {},
              submitLabel: action.data.submitLabel,
            }, null, 2),
          }],
        };
      }

      case 'webdex_submit_form': {
        const a = args as any;
        const actionResult = await dbQuery(
          "SELECT * FROM entities WHERE id = $1 AND category = 'action'",
          [a.action_id]
        );
        if (actionResult.rows.length === 0) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: 'Action not found' }) }] };
        }

        const entity = actionResult.rows[0];
        const actionData = entity.data;

        if (!actionData.endpoint) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: 'No endpoint mapped for this action. The form may use JavaScript to submit.' }) }] };
        }

        // Check trust level
        const trustResult = await dbQuery(
          'SELECT trust_level, approved_successes FROM action_trust_levels WHERE action_id = $1',
          [a.action_id]
        );
        const trust = (trustResult.rows[0]?.trust_level as string) || 'requires_approval';

        if (trust === 'trusted') {
          // Execute hands-free via API
          const apiUrl = process.env.API_BASE_URL || 'http://localhost:4000';
          const apiKey = process.env.INTERNAL_API_KEY || '';

          const res = await fetch(`${apiUrl}/v1/actions/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
            body: JSON.stringify({ action_id: a.action_id, data: a.data }),
          });
          const result = await res.json() as any;
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        // Needs approval — create a pending submission and return token to agent
        const { randomBytes } = await import('crypto');
        const token = randomBytes(16).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

        const subResult = await dbQuery(
          `INSERT INTO action_submissions
             (action_id, domain, submitted_data, status, approval_token, approval_token_expires_at)
           VALUES ($1,$2,$3,'pending_approval',$4,$5) RETURNING id`,
          [a.action_id, entity.domain, JSON.stringify(a.data || {}), token, expiresAt]
        );

        const apiUrl = process.env.API_BASE_URL || 'http://localhost:4000';
        const trustMessages: Record<string, string> = {
          requires_approval: 'This is the first time this action is being submitted. Human approval is required.',
          provisionally_trusted: 'This action has one prior approved success. One more approval will make it hands-free.',
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'approval_required',
              submission_id: subResult.rows[0].id,
              approval_token: token,
              trust_level: trust,
              message: trustMessages[trust] || 'Human approval required before this action can execute.',
              instructions: `A human must review and approve this action. Send them to: POST ${apiUrl}/v1/actions/approve/${token}`,
              action_summary: {
                domain: entity.domain,
                purpose: actionData.purpose,
                endpoint: actionData.endpoint,
                method: actionData.method || 'POST',
                data_to_submit: a.data,
              },
              approve_endpoint: `POST ${apiUrl}/v1/actions/approve/${token}`,
              reject_endpoint: `POST ${apiUrl}/v1/actions/reject/${token}`,
            }, null, 2),
          }],
        };
      }

      case 'webdex_check_action_trust': {
        const result = await dbQuery(
          'SELECT * FROM action_trust_levels WHERE action_id = $1',
          [(args as any).action_id]
        );
        const row = result.rows[0] || {
          action_id: (args as any).action_id,
          trust_level: 'requires_approval',
          total_attempts: 0,
          approved_successes: 0,
        };
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              ...row,
              hands_free_eligible: row.trust_level === 'trusted',
              approvals_still_needed: Math.max(0, 2 - (row.approved_successes || 0)),
            }, null, 2),
          }],
        };
      }

      case 'webdex_assemble': {
        const conditions: string[] = [];
        const values: unknown[] = [];
        let idx = 0;

        if ((args as any).categories?.length) {
          idx++;
          conditions.push(`category = ANY($${idx})`);
          values.push((args as any).categories);
        }
        if ((args as any).domain) {
          idx++;
          conditions.push(`domain = $${idx}`);
          values.push((args as any).domain);
        }
        if ((args as any).location) {
          idx++;
          conditions.push(`searchable_text ILIKE $${idx}`);
          values.push(`%${(args as any).location}%`);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const limit = (args as any).limit || 50;
        const result = await dbQuery(
          `SELECT id, category, domain, data, confidence, aieo_score FROM entities ${where} ORDER BY aieo_score DESC LIMIT ${limit}`,
          values
        );
        return { content: [{ type: 'text', text: JSON.stringify({ total: result.rows.length, entities: result.rows }, null, 2) }] };
      }

      case 'webdex_compare': {
        const ids = (args as any).entity_ids as string[];
        if (!ids?.length) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: 'entity_ids array is required' }) }] };
        }
        const result = await dbQuery(
          'SELECT id, category, domain, data, confidence, aieo_score FROM entities WHERE id = ANY($1) ORDER BY aieo_score DESC',
          [ids]
        );

        // Group by category for a cleaner comparison view
        const byCategory: Record<string, any[]> = {};
        for (const row of result.rows) {
          if (!byCategory[row.category]) byCategory[row.category] = [];
          byCategory[row.category].push(row);
        }

        return { content: [{ type: 'text', text: JSON.stringify({ total: result.rows.length, by_category: byCategory }, null, 2) }] };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (error) {
    return { content: [{ type: 'text', text: `Error executing ${name}: ${error}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🔌 WebDex MCP server running on stdio');
}

main().catch(console.error);
