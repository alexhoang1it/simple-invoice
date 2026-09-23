# SimpleInvoice — task runner.
#
# The two packages are independent (each has its own package.json and lockfile),
# so these targets are the single place that knows how to drive both at once.
#
#   make help     list everything

SHELL := /bin/sh
API   := backend
WEB   := frontend

.DEFAULT_GOAL := help
.PHONY: help up down logs reset install db migrate seed api web build test test-api test-web \
        test-e2e cov lint format check

help: ## Show this list
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

# -- docker -----------------------------------------------------------------

up: ## Build and start the whole stack
	docker compose up --build

down: ## Stop the stack (add ARGS=-v to drop the database volume)
	docker compose down $(ARGS)

logs: ## Tail the logs
	docker compose logs -f

reset: ## Tear everything down, volume included, and start fresh
	docker compose down -v
	docker compose up --build

# -- local development ------------------------------------------------------

install: ## Install dependencies for both packages
	cd $(API) && npm install
	cd $(WEB) && npm install

db: ## Start only Postgres, for running the app on the host
	docker compose up -d db

migrate: ## Apply pending migrations
	cd $(API) && npm run migrate

seed: ## Apply migrations, then load the demo data
	cd $(API) && npm run migrate && npm run seed

api: ## Run the API in watch mode (port 4000)
	cd $(API) && npm run dev

web: ## Run the web client in watch mode (port 5174)
	cd $(WEB) && npm run dev

build: ## Production build of both packages
	cd $(API) && npm run build
	cd $(WEB) && npm run build

# -- quality ----------------------------------------------------------------

test: test-api test-web ## Unit tests for both packages

test-api: ## API unit tests
	cd $(API) && npm test

test-web: ## Web unit tests
	cd $(WEB) && npm test

test-e2e: ## API end-to-end tests (needs Postgres running)
	cd $(API) && npm run test:e2e

cov: ## Unit tests with coverage, enforcing the 60% floor
	cd $(API) && npm run test:cov
	cd $(WEB) && npm run test:cov

lint: ## Lint both packages
	cd $(API) && npm run lint
	cd $(WEB) && npm run lint

format: ## Rewrite both packages with Prettier
	cd $(API) && npm run format
	cd $(WEB) && npm run format

check: lint cov build ## What CI runs
