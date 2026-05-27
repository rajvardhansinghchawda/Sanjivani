"""
Django management command: ai_train
=====================================
Trains (or retrains) the XGBoost adherence risk model.

Usage:
    python manage.py ai_train --model-version 1.0.0
    python manage.py ai_train --model-version 1.1.0 --generate-data
    python manage.py ai_train --model-version 1.0.0 --patients 5000 --days 60
"""

import logging
from dataclasses import asdict

from django.core.management.base import BaseCommand, CommandError

logger = logging.getLogger("medadhere.ai_engine")


class Command(BaseCommand):
    help = "Train (or retrain) the AI adherence risk model"

    def add_arguments(self, parser):
        parser.add_argument(
            "--model-version",
            default="1.0.0",
            help="Semantic version tag for this model (e.g. 1.0.0)",
        )
        parser.add_argument(
            "--patients",
            type=int,
            default=10_000,
            help="Number of synthetic patients to generate if no data exists (default: 10000)",
        )
        parser.add_argument(
            "--days",
            type=int,
            default=90,
            help="Days of adherence history to simulate (default: 90)",
        )
        parser.add_argument(
            "--data-dir",
            default=None,
            help="Custom training data directory (overrides AI_DATA_DIR env var)",
        )
        parser.add_argument(
            "--model-dir",
            default=None,
            help="Custom model artifact output directory (overrides AI_MODEL_DIR env var)",
        )
        parser.add_argument(
            "--generate-data",
            action="store_true",
            help="Force-generate fresh synthetic dataset before training",
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.MIGRATE_HEADING(
                "\n=== MedAdhere AI Engine — Model Training ==="
            )
        )

        version = options["model_version"]
        self.stdout.write(f"  Model version : {version}")
        self.stdout.write(
            f"  Generate data : {'YES' if options['generate_data'] else 'NO (use existing)'}"
        )

        # ── Step 1: Optionally generate synthetic training data ──────────────
        if options["generate_data"]:
            self.stdout.write(
                self.style.HTTP_INFO(
                    f"\n[1/2] Generating synthetic training data "
                    f"({options['patients']:,} patients, {options['days']} days)..."
                )
            )
            try:
                from apps.ai_engine.datasets.generator import generate_dataset

                data_result = generate_dataset(
                    n_patients=options["patients"],
                    n_days=options["days"],
                    output_dir=options["data_dir"] or "apps/ai_engine/datasets/raw",
                )
                stats = data_result["stats"]
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  ✓ Generated {stats['n_events']:,} adherence events "
                        f"| {stats['overall_adherence_rate']}% adherence rate "
                        f"| {stats['miss_rate']}% miss rate"
                    )
                )
            except Exception as e:
                raise CommandError(f"Synthetic data generation failed: {e}")
        else:
            self.stdout.write(self.style.HTTP_INFO("\n[1/2] Skipping data generation — using existing dataset"))

        # ── Step 2: Train model ───────────────────────────────────────────────
        self.stdout.write(
            self.style.HTTP_INFO(f"\n[2/2] Training XGBoost model v{version}...")
        )
        try:
            from apps.ai_engine.services.training import TrainingConfig, train_model

            config = TrainingConfig(model_version=version)
            result = train_model(
                config=config,
                data_dir=options.get("data_dir"),
                model_dir=options.get("model_dir"),
            )

            self.stdout.write(self.style.SUCCESS("\n✓ Training complete!"))
            self.stdout.write(f"  AUC-ROC   : {result.auc_roc:.4f}")
            self.stdout.write(f"  F1 Score  : {result.f1_score:.4f}")
            self.stdout.write(f"  Precision : {result.precision:.4f}")
            self.stdout.write(f"  Recall    : {result.recall:.4f}")
            self.stdout.write(f"  Brier     : {result.brier_score:.4f}")
            self.stdout.write(f"  Artifact  : {result.artifact_path}")
            self.stdout.write(f"  Trained at: {result.trained_at}")

            self.stdout.write("\nTop 5 feature importances:")
            for i, (feat, imp) in enumerate(
                list(result.feature_importances.items())[:5], 1
            ):
                self.stdout.write(f"  {i}. {feat}: {imp:.4f}")

            self.stdout.write(
                self.style.SUCCESS(
                    f"\n✓ Model v{version} is now active. "
                    "Restart the inference service to load it, or use POST /ai/retrain/ via API."
                )
            )

        except Exception as e:
            raise CommandError(f"Training failed: {e}")
