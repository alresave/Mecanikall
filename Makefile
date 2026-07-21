.DEFAULT_GOAL := help

NPM := npm

.PHONY: help install dev build test check clean

help: ## Muestra los comandos disponibles.
	@awk 'BEGIN {FS = ":.*##"}; /^[a-zA-Z_-]+:.*##/ {printf "\033[36m%-12s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Instala dependencias (usa npm ci si existe package-lock.json).
	@if [ -f package-lock.json ]; then $(NPM) ci; else $(NPM) install; fi

dev: ## Inicia el servidor de desarrollo en http://localhost:4200.
	$(NPM) run start

build: ## Genera la compilación de producción.
	$(NPM) run build

test: ## Ejecuta pruebas unitarias.
	$(NPM) run test -- --watch=false

check: ## Verifica que el proyecto compile para producción.
	$(NPM) run build

clean: ## Elimina artefactos de compilación y caché de Angular.
	rm -rf dist .angular/cache
