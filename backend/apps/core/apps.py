from django.apps import AppConfig

class CoreConfig(AppConfig):
    name = 'apps.core'
    verbose_name = 'Core Application'

    def ready(self):
        try:
            from agenthandover import bootstrap_agents
            from medadhere_extensions_handover import (
                bootstrap_extension_agents,
                register_extension_events,
            )
            
            # 1. Bootstrap Core Agents First
            bootstrap_agents()
            
            # 2. Bootstrap Extension Agents Second
            bootstrap_extension_agents()

            # 3. Register Extension Event Handlers
            register_extension_events()
            
            print("[OK] Agent Ecosystem Bootstrapped Successfully")
        except ImportError as e:
            print(f"[!] Failed to bootstrap agents: {e}")
