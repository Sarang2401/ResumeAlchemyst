# ResumeAlchemyst DevOps Deployment

This repository contains the Infrastructure-as-Code (Terraform) and deployment scripts to deploy the `ResumeAlchemyst` GenAI application across multiple VMs in a private subnet, exposing inference over a JSON HTTP API via a Gateway.

## Architecture

```text
                        +----------------------+
                        |   Public Internet    |
                        +----------+-----------+
                                   | HTTP (Port 80)
                                   v
+----------------------------------+----------------------------------+
| AWS VPC (10.0.0.0/16)            |                                  |
|                                  |                                  |
|  +-------------------------------+-------------------------------+  |
|  | Public Subnet (10.0.1.0/24)                                   |  |
|  |                                                               |  |
|  |   +-----------------------+       +-----------------------+   |  |
|  |   |   NAT Gateway         |       |    API Gateway (VM1)  |   |  |
|  |   |   (For outbound DL)   |       |    Nginx Proxy        |   |  |
|  |   |                       |       |    EIP: Public IP     |   |  |
|  |   +-----------------------+       +-----------+-----------+   |  |
|  |                                               |               |  |
|  +-----------------------------------------------+---------------+  |
|                                                  |                  |
|                                                  | Proxied HTTP     |
|                                                  | Traffic          |
|  +-----------------------------------------------+---------------+  |
|  | Private Subnet (10.0.2.0/24)                  |               |  |
|  |                                               |               |  |
|  |        +--------------------------------------+-------+       |  |
|  |        |                                              |       |  |
|  |        v /api/*                                       v /     |  |
|  |  +-----+-----------------+             +--------------+------+ |  |
|  |  | Python Worker (VM2)   |             | TS Worker (VM3)     | |  |
|  |  | FastAPI JSON API      |   <=====>   | Next.js Frontend    | |  |
|  |  | IP: 10.0.2.10:8000    |    (RPC)    | IP: 10.0.2.11:3000  | |  |
|  |  +-----------------------+             +---------------------+ |  |
|  +---------------------------------------------------------------+  |
+---------------------------------------------------------------------+
```

*   **API Gateway:** Publicly accessible. Routes frontend UI requests (`/`) to the Next.js Worker and API/Inference requests (`/api/*`) to the Python Worker.
*   **Python Worker:** Hosts the AI inference logic. Completely private.
*   **TS Worker:** Hosts the React Server Components UI. Completely private.

## Redeployment Instructions

To deploy this stack into a fresh AWS account:

1.  **Clone this project repository** containing the Terraform code.
2.  **Ensure you have AWS Credentials configured** locally (e.g., via `aws configure`).
3.  **Navigate to the Terraform directory:**
    ```bash
    cd devops-submission/terraform
    ```
4.  **Initialize and Apply:**
    ```bash
    terraform init
    terraform apply
    ```
5.  Type `yes` when prompted. Terraform will output the Gateway's public IP address (`gateway_public_ip`) and the API endpoint URL (`api_endpoint`) upon completion.
6.  **Wait ~3-5 minutes** for the instances to boot and the `user-data` scripts to finish installing Python, Node, and Nginx.

## Exposing Inference as a JSON API (cURL Command)

Once deployed, the Nginx Gateway proxies `/api/health` to the Python worker's `/health` endpoint. You can test the JSON API connectivity with:

```bash
# Replace <GATEWAY_IP> with the actual gateway_public_ip output from Terraform
curl -X GET http://<GATEWAY_IP>/api/health -H "Accept: application/json"
```

### Sample Response
```json
{
  "status": "healthy",
  "total_sessions": 0,
  "uptime": 120
}
```

You can also test the full inference endpoint by uploading a file (if you have a sample resume available):
```bash
curl -X POST http://<GATEWAY_IP>/api/upload-resume \
  -F "file=@sample_resume.pdf" \
  -H "Accept: application/json"
```
