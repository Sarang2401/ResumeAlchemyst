# Infrastructure Writeup

## Hardening for Production

If this implementation were moving out of a PoC / Assignment stage and into a true production environment, several hardening measures would be required:

1.  **HTTPS / TLS Termination:** Currently, the Nginx API Gateway is listening on HTTP port 80. In production, we would provision an AWS Application Load Balancer (ALB) or configure Nginx with a Let's Encrypt certificate to terminate TLS (port 443) to ensure data-in-transit encryption, especially since we are dealing with candidate resumes.
2.  **Web Application Firewall (WAF):** Place the API Gateway behind an AWS WAF to prevent common OWASP top 10 vulnerabilities (SQLi, XSS) and rate-limit abusive requests to the expensive AI inference endpoints.
3.  **IAM & Instance Profiles:** Instead of hardcoding credentials, the EC2 workers should assume AWS IAM Roles (Instance Profiles) to fetch any necessary secrets (e.g., OpenAI API Keys) dynamically from AWS Secrets Manager or Parameter Store during runtime, rather than storing them in `.env` files on disk.
4.  **Network ACLs & Strict SG Rules:** Ensure that Security Groups strictly limit traffic. Currently, they allow all outbound traffic. In a hardened environment, outbound traffic from the private subnet should be restricted only to necessary AWS service endpoints and specific external APIs (like OpenAI/Anthropic APIs).

## Scaling for a 100x Larger Model

The current architecture uses a "tiny SLM" that runs comfortably on `t3.micro` instances. If the model was 100x larger (e.g., a massive LLM requiring GPU acceleration), the architecture would need the following fundamental shifts:

1.  **GPU-Optimized Instances:** The Python Worker would need to be migrated from a standard `t3` CPU instance to an accelerated computing instance (e.g., AWS `g5` or `p4` instances with NVIDIA GPUs).
2.  **Auto Scaling Groups (ASG):** Model inference is computationally expensive and subject to variable traffic. We would place the Python Workers in an Auto Scaling Group behind an internal Application Load Balancer. The ASG would scale based on custom CloudWatch metrics like GPU utilization or queue depth.
3.  **Asynchronous Message Queues:** A synchronous HTTP API (like FastAPI `POST /upload-resume`) will timeout if a large model takes 30-60 seconds to process a document. We would implement an asynchronous queue (e.g., AWS SQS + Celery or Redis). The Gateway would drop the inference request into the queue and return a `job_id`. The client (Next.js) would then poll the Gateway (or use WebSockets) to get the result once the GPU worker finishes processing it from the queue.
4.  **Model Serving Frameworks:** Instead of serving the model directly inside the FastAPI app, we would use a dedicated high-performance inference server (like vLLM, Triton Inference Server, or TGI) and have the Python FastAPI worker act as an orchestration layer calling the local inference server.
