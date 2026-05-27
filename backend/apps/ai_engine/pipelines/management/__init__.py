"""
Django management command: ai_train
Usage: python manage.py ai_train --model-version 1.0.0 [--patients 10000] [--days 90]
"""
from django.core.management.base import BaseCommand, CommandError
import logging

logger = logging.getLogger("medadhere.ai_engine")


class Command(BaseCommand):
    help = "Train (or retrain) the AI adherence risk model"

    def add_arguments(self, parser):
        parser.add_argument("--model-version", default="1.0.0", help="Semantic version (e.g. 1.0.0)")
        parser.add_argument("--patients", type=int, default=10_000, help="Synthetic patient count if no data exists")
        parser.add_argument("--days", type=int, default=90, help="Days of history to generate")
        parser.add_argument("--data-dir", default=None, help="Custom data directory")
        parser.add_argument("--model-dir", default=None, help="Custom model output directory")
        parser.add_argument("--generate-data", action="store_true", help="Force regenerate synthetic data")

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("=== MedAdhere AI Engine — Model Training ==="))

        version = options["model_version"]
        self.stdout.write(f"Model version: {version}")

        # Optionally generate fresh synthetic data
        if options["generate_data"]:
            self.stdout.write("Generating synthetic training data...")
            from apps.ai_engine.datasets.generator import generate_dataset
            result = generate_dataset(
                n_patients=options["patients"],
                n_days=options["days"],
                output_dir=options["data_dir"] or "apps/ai_engine/datasets/raw",
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f"Data generated: {result['stats']['n_events']:,} events, "
                    f"{result['stats']['overall_adherence_rate']}% adherence rate"
                )
            )

        # Run training
        self.stdout.write("Starting model training...")
        try:
            from apps.ai_engine.services.training import TrainingConfig, train_model
            from dataclasses import asdict
            import json

            config = TrainingConfig(model_version=version)
            result = train_model(
                config=config,
                data_dir=options.get("data_dir"),
                model_dir=options.get("model_dir"),
            )

            self.stdout.write(self.style.SUCCESS("\n✓ Training complete!"))
            self.stdout.write(f"  AUC-ROC:   {result.auc_roc:.4f}")
            self.stdout.write(f"  F1 Score:  {result.f1_score:.4f}")
            self.stdout.write(f"  Precision: {result.precision:.4f}")
            self.stdout.write(f"  Recall:    {result.recall:.4f}")
            self.stdout.write(f"  Brier:     {result.brier_score:.4f}")
            self.stdout.write(f"  Artifact:  {result.artifact_path}")

            self.stdout.write("\nTop 5 feature importances:")
            for i, (feat, imp) in enumerate(list(result.feature_importances.items())[:5], 1):
                self.stdout.write(f"  {i}. {feat}: {imp:.4f}")

        except Exception as e:
            raise CommandError(f"Training failed: {e}")
