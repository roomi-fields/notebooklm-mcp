import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

/**
 * Where the local server listens, and the token it asks for once it is
 * exposed beyond loopback.
 *
 * There is no Google credential here on purpose: the Google session lives in
 * the server, on the machine it was created on, because it is bound to that
 * machine and expires server-side while its cookies still look valid. A
 * credential in n8n cannot hold that, and pretending otherwise is how a
 * workflow breaks silently a week later.
 */
export class NotebookLmApi implements ICredentialType {
  name = 'notebookLmApi';

  displayName = 'NotebookLM (Gemini Notebook) API';

  documentationUrl = 'https://notebooklm.roomi-fields.com/notebooklm-n8n';

  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'http://127.0.0.1:3000',
      placeholder: 'http://127.0.0.1:3000',
      description:
        'Address of the notebooklm-mcp server. On loopback it needs no token; as soon as it is exposed it refuses to start without one.',
    },
    {
      displayName: 'API Token',
      name: 'apiToken',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'Leave empty for a loopback server started without a token',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization:
          '={{ $credentials.apiToken ? "Bearer " + $credentials.apiToken : undefined }}',
      },
    },
  };

  /** The one route that answers without a notebook, a session or a login. */
  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{ $credentials.baseUrl }}',
      url: '/health',
    },
  };
}
