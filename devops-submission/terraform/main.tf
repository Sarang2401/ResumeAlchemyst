provider "aws" {
  region = var.aws_region
}

# -----------------------------------------------------------------------------
# VPC and Networking
# -----------------------------------------------------------------------------

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "resume-alchemyst-vpc"
  }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "resume-alchemyst-igw"
  }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidr
  map_public_ip_on_launch = true
  availability_zone       = "${var.aws_region}a"

  tags = {
    Name = "resume-alchemyst-public-subnet"
  }
}

resource "aws_subnet" "private" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidr
  availability_zone = "${var.aws_region}a"

  tags = {
    Name = "resume-alchemyst-private-subnet"
  }
}

resource "aws_eip" "nat_eip" {
  domain = "vpc"
}

resource "aws_nat_gateway" "nat" {
  allocation_id = aws_eip.nat_eip.id
  subnet_id     = aws_subnet.public.id
  depends_on    = [aws_internet_gateway.igw]

  tags = {
    Name = "resume-alchemyst-nat"
  }
}

resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = {
    Name = "resume-alchemyst-public-rt"
  }
}

resource "aws_route_table_association" "public_assoc" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public_rt.id
}

resource "aws_route_table" "private_rt" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat.id
  }

  tags = {
    Name = "resume-alchemyst-private-rt"
  }
}

resource "aws_route_table_association" "private_assoc" {
  subnet_id      = aws_subnet.private.id
  route_table_id = aws_route_table.private_rt.id
}

# -----------------------------------------------------------------------------
# Security Groups
# -----------------------------------------------------------------------------

resource "aws_security_group" "gateway_sg" {
  name        = "gateway-sg"
  description = "Allow HTTP inbound traffic"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH from anywhere for GitHub Actions"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "gateway-sg"
  }
}

resource "aws_security_group" "worker_sg" {
  name        = "worker-sg"
  description = "Allow inbound traffic from gateway"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Next.js UI from gateway"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.gateway_sg.id]
  }

  ingress {
    description     = "FastAPI from gateway"
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.gateway_sg.id]
  }

  ingress {
    description     = "SSH from gateway for deployments"
    from_port       = 22
    to_port         = 22
    protocol        = "tcp"
    security_groups = [aws_security_group.gateway_sg.id]
  }

  # Allow all internal traffic between workers if needed
  ingress {
    description = "Internal RPC between workers"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    self        = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "worker-sg"
  }
}

# -----------------------------------------------------------------------------
# SSH Key Pair for CI/CD Deployment
# -----------------------------------------------------------------------------

resource "tls_private_key" "deploy_key" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "deploy_key_pair" {
  key_name   = "resume-alchemyst-deploy-key"
  public_key = tls_private_key.deploy_key.public_key_openssh
}

# -----------------------------------------------------------------------------
# EC2 Instances
# -----------------------------------------------------------------------------

data "aws_ami" "ubuntu" {
  most_recent = true
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
  owners = ["099720109477"] # Canonical
}

# Elastic IP for the Gateway so we can provide a static public URL
resource "aws_eip" "gateway_eip" {
  domain = "vpc"
}

# Allocate static private IPs to resolve cyclic dependency in user_data
locals {
  python_worker_ip = "10.0.2.10"
  ts_worker_ip     = "10.0.2.11"
}

resource "aws_instance" "python_worker" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.private.id
  private_ip             = local.python_worker_ip
  key_name               = aws_key_pair.deploy_key_pair.key_name
  vpc_security_group_ids = [aws_security_group.worker_sg.id]
  depends_on             = [aws_nat_gateway.nat, aws_route_table_association.private_assoc]

  user_data = templatefile("${path.module}/../scripts/setup_python_worker.sh", {})

  tags = {
    Name = "resume-alchemyst-python-worker"
  }
}

resource "aws_instance" "ts_worker" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.private.id
  private_ip             = local.ts_worker_ip
  key_name               = aws_key_pair.deploy_key_pair.key_name
  vpc_security_group_ids = [aws_security_group.worker_sg.id]
  depends_on             = [aws_nat_gateway.nat, aws_route_table_association.private_assoc]

  user_data = templatefile("${path.module}/../scripts/setup_ts_worker.sh", {
    gateway_public_ip = aws_eip.gateway_eip.public_ip
  })

  tags = {
    Name = "resume-alchemyst-ts-worker"
  }
}

resource "aws_instance" "gateway" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  key_name               = aws_key_pair.deploy_key_pair.key_name
  vpc_security_group_ids = [aws_security_group.gateway_sg.id]

  user_data = templatefile("${path.module}/../scripts/setup_gateway.sh", {
    python_worker_ip = local.python_worker_ip
    ts_worker_ip     = local.ts_worker_ip
  })

  tags = {
    Name = "resume-alchemyst-gateway"
  }
}

# Associate the Elastic IP with the Gateway instance
resource "aws_eip_association" "gateway_eip_assoc" {
  instance_id   = aws_instance.gateway.id
  allocation_id = aws_eip.gateway_eip.id
}

output "gateway_public_ip" {
  value = aws_eip.gateway_eip.public_ip
}

output "api_endpoint" {
  value = "http://${aws_eip.gateway_eip.public_ip}/api/health"
}

output "private_ssh_key" {
  value     = tls_private_key.deploy_key.private_key_pem
  sensitive = true
}
