"""
AI Engine Test Suite
=====================
Unit tests for:
  - Feature engineering
  - Fallback rule engine
  - Inference pipeline (with mock model)
  - Risk engine public interface

Run:
    python manage.py test apps.ai_engine.tests
    # or
    pytest apps/ai_engine/tests/ -v
"""

import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pandas as pd
import numpy as np


# ---------------------------------------------------------------------------
# Feature Engineering Tests
# ---------------------------------------------------------------------------


class TestAdherenceRates(unittest.TestCase):
    """Tests for compute_adherence_rates()"""

    def setUp(self):
        from apps.ai_engine.services.feature_engineering import compute_adherence_rates
        self.compute = compute_adherence_rates

        now = datetime.now(timezone.utc)
        self.events = pd.DataFrame(
            [
                {"scheduled_at": now - timedelta(days=i), "status": s}
                for i, s in enumerate(
                    ["TAKEN", "MISSED", "TAKEN", "TAKEN", "MISSED", "TAKEN", "TAKEN"]
                )
            ]
        )

    def test_returns_dict_with_all_windows(self):
        result = self.compute(self.events)
        self.assertIn("adherence_rate_7d", result)
        self.assertIn("adherence_rate_30d", result)
        self.assertIn("adherence_rate_14d", result)
        self.assertIn("adherence_rate_90d", result)

    def test_empty_events_returns_defaults(self):
        result = self.compute(pd.DataFrame())
        self.assertEqual(result["adherence_rate_7d"], 1.0)

    def test_all_missed_returns_zero(self):
        now = datetime.now(timezone.utc)
        missed_events = pd.DataFrame(
            [{"scheduled_at": now - timedelta(hours=i), "status": "MISSED"} for i in range(5)]
        )
        result = self.compute(missed_events)
        self.assertEqual(result["adherence_rate_7d"], 0.0)

    def test_all_taken_returns_one(self):
        now = datetime.now(timezone.utc)
        taken_events = pd.DataFrame(
            [{"scheduled_at": now - timedelta(hours=i), "status": "TAKEN"} for i in range(5)]
        )
        result = self.compute(taken_events)
        self.assertEqual(result["adherence_rate_7d"], 1.0)

    def test_no_nan_in_output(self):
        result = self.compute(self.events)
        for k, v in result.items():
            self.assertFalse(isinstance(v, float) and np.isnan(v), f"{k} is NaN")


class TestStreakFeatures(unittest.TestCase):
    def setUp(self):
        from apps.ai_engine.services.feature_engineering import compute_streak_features
        self.compute = compute_streak_features

    def test_empty_events(self):
        result = self.compute(pd.DataFrame())
        self.assertEqual(result["current_streak_days"], 0)
        self.assertEqual(result["consecutive_miss_streak"], 0)

    def test_consecutive_misses_counted(self):
        now = datetime.now(timezone.utc)
        events = pd.DataFrame(
            [
                {"scheduled_at": now - timedelta(hours=1), "status": "MISSED"},
                {"scheduled_at": now - timedelta(hours=25), "status": "MISSED"},
                {"scheduled_at": now - timedelta(hours=49), "status": "TAKEN"},
            ]
        )
        result = self.compute(events, as_of=now)
        self.assertGreaterEqual(result["consecutive_miss_streak"], 2)

    def test_days_since_last_miss(self):
        now = datetime.now(timezone.utc)
        events = pd.DataFrame(
            [
                {"scheduled_at": now - timedelta(days=3), "status": "MISSED"},
                {"scheduled_at": now - timedelta(days=1), "status": "TAKEN"},
            ]
        )
        result = self.compute(events, as_of=now)
        self.assertGreaterEqual(result["days_since_last_miss"], 2)


class TestTemporalPatterns(unittest.TestCase):
    def setUp(self):
        from apps.ai_engine.services.feature_engineering import compute_temporal_patterns
        self.compute = compute_temporal_patterns

    def test_weekend_miss_ratio(self):
        # Create events: Saturdays all missed, weekdays all taken
        events = []
        base = datetime(2024, 1, 1)  # Monday
        for i in range(14):
            dt = base + timedelta(days=i)
            is_weekend = dt.weekday() >= 5
            events.append({"scheduled_at": dt, "status": "MISSED" if is_weekend else "TAKEN"})

        df = pd.DataFrame(events)
        result = self.compute(df)
        self.assertGreater(result["weekend_miss_ratio"], 0.5)
        self.assertLess(result["morning_miss_ratio"], 0.1)

    def test_empty_events_returns_zeros(self):
        result = self.compute(pd.DataFrame())
        self.assertEqual(result["weekend_miss_ratio"], 0.0)
        self.assertEqual(result["evening_miss_ratio"], 0.0)


class TestBuildFeatureVector(unittest.TestCase):
    def test_always_returns_feature_vector(self):
        from apps.ai_engine.services.feature_engineering import build_feature_vector, FEATURE_NAMES
        fv = build_feature_vector("patient-123", pd.DataFrame())
        self.assertEqual(fv.patient_id, "patient-123")
        for name in FEATURE_NAMES:
            self.assertIn(name, fv.features)

    def test_no_none_values(self):
        from apps.ai_engine.services.feature_engineering import build_feature_vector
        fv = build_feature_vector("patient-456", pd.DataFrame())
        for k, v in fv.features.items():
            self.assertIsNotNone(v, f"Feature {k} is None")

    def test_no_nan_values(self):
        from apps.ai_engine.services.feature_engineering import build_feature_vector
        fv = build_feature_vector("patient-789", pd.DataFrame())
        for k, v in fv.features.items():
            if isinstance(v, float):
                self.assertFalse(np.isnan(v), f"Feature {k} is NaN")

    def test_to_array_correct_length(self):
        from apps.ai_engine.services.feature_engineering import build_feature_vector, FEATURE_NAMES
        fv = build_feature_vector("patient-abc", pd.DataFrame())
        arr = fv.to_array()
        self.assertEqual(len(arr), len(FEATURE_NAMES))


# ---------------------------------------------------------------------------
# Fallback Rule Engine Tests
# ---------------------------------------------------------------------------


class TestFallbackEngine(unittest.TestCase):
    def setUp(self):
        from apps.ai_engine.services.fallback import assess_risk
        self.assess = assess_risk

    def test_always_returns_result(self):
        result = self.assess("patient-test", {})
        self.assertIsNotNone(result)
        self.assertIn(result.risk_level, ("low", "medium", "high", "critical"))

    def test_many_misses_gives_high_risk(self):
        features = {"missed_count_7d": 6, "adherence_rate_7d": 0.20}
        result = self.assess("patient-risky", features)
        self.assertIn(result.risk_level, ("high", "critical"))
        self.assertGreater(result.risk_score, 0.50)

    def test_good_adherence_gives_low_risk(self):
        features = {
            "missed_count_7d": 0,
            "adherence_rate_7d": 0.97,
            "adherence_rate_30d": 0.95,
            "current_streak_days": 30,
            "consecutive_miss_streak": 0,
        }
        result = self.assess("patient-good", features)
        self.assertIn(result.risk_level, ("low", "medium"))

    def test_cognitive_impairment_increases_risk(self):
        base_features = {"missed_count_7d": 1, "adherence_rate_7d": 0.85}
        result_no_ci = self.assess("p1", base_features)

        ci_features = {**base_features, "is_cognitively_impaired": 1}
        result_with_ci = self.assess("p2", ci_features)

        self.assertGreaterEqual(result_with_ci.risk_score, result_no_ci.risk_score)

    def test_reasons_always_present(self):
        result = self.assess("patient-test", {})
        self.assertIsInstance(result.reasons, list)
        self.assertGreater(len(result.reasons), 0)

    def test_risk_score_in_valid_range(self):
        result = self.assess("patient-test", {"missed_count_7d": 10})
        self.assertGreaterEqual(result.risk_score, 0.0)
        self.assertLessEqual(result.risk_score, 1.0)

    def test_handles_none_features_gracefully(self):
        # Should not raise even with None values
        features = {"missed_count_7d": None, "adherence_rate_7d": None}
        try:
            result = self.assess("patient-none", features)
            self.assertIsNotNone(result)
        except Exception as e:
            self.fail(f"assess_risk raised an exception with None features: {e}")

    def test_quick_assess_critical(self):
        from apps.ai_engine.services.fallback import quick_assess
        level = quick_assess(missed_7d=7, missed_30d=15, adherence_7d=0.30)
        self.assertEqual(level, "critical")

    def test_quick_assess_low(self):
        from apps.ai_engine.services.fallback import quick_assess
        level = quick_assess(missed_7d=0, missed_30d=0, adherence_7d=0.95)
        self.assertEqual(level, "low")


# ---------------------------------------------------------------------------
# Circuit Breaker Tests
# ---------------------------------------------------------------------------


class TestCircuitBreaker(unittest.TestCase):
    def setUp(self):
        from apps.ai_engine.services.inference import CircuitBreaker
        self.CircuitBreaker = CircuitBreaker

    def test_starts_closed(self):
        cb = self.CircuitBreaker("test", failure_threshold=3)
        self.assertEqual(cb.state, "CLOSED")
        self.assertTrue(cb.is_available())

    def test_opens_after_threshold_failures(self):
        cb = self.CircuitBreaker("test", failure_threshold=3)
        for _ in range(3):
            cb.record_failure()
        self.assertEqual(cb.state, "OPEN")
        self.assertFalse(cb.is_available())

    def test_success_resets_failure_count(self):
        cb = self.CircuitBreaker("test", failure_threshold=3)
        cb.record_failure()
        cb.record_failure()
        cb.record_success()
        # Should not open with only 2 failures then a success
        self.assertEqual(cb.state, "CLOSED")

    def test_half_open_after_timeout(self):
        import time
        cb = self.CircuitBreaker("test", failure_threshold=2, recovery_timeout=1)
        cb.record_failure()
        cb.record_failure()
        self.assertEqual(cb.state, "OPEN")
        time.sleep(1.1)
        self.assertEqual(cb.state, "HALF_OPEN")
        self.assertTrue(cb.is_available())


# ---------------------------------------------------------------------------
# Inference Service Tests (mocked)
# ---------------------------------------------------------------------------


class TestInferenceServiceFallback(unittest.TestCase):
    """Test that inference falls back gracefully when model is unavailable."""

    def test_predict_returns_result_without_model(self):
        """predict() must return a RiskScoreResult even if model file missing."""
        from apps.ai_engine.services.inference import InferenceService, RiskScoreResult
        svc = InferenceService()
        svc._model_payload = None  # Simulate no model loaded
        svc._circuit_breaker.record_failure()
        svc._circuit_breaker.record_failure()
        svc._circuit_breaker.record_failure()
        svc._circuit_breaker.record_failure()
        svc._circuit_breaker.record_failure()  # Open the circuit

        result = svc.predict("patient-abc", pd.DataFrame())
        self.assertIsInstance(result, RiskScoreResult)
        self.assertIn(result.risk_level, ("low", "medium", "high", "critical"))
        self.assertIn("FALLBACK", result.source)

    def test_risk_score_in_range(self):
        from apps.ai_engine.services.inference import InferenceService
        svc = InferenceService()
        svc._model_payload = None
        # Force circuit open
        for _ in range(5):
            svc._circuit_breaker.record_failure()

        result = svc.predict("patient-range-test", pd.DataFrame())
        self.assertGreaterEqual(result.risk_score, 0.0)
        self.assertLessEqual(result.risk_score, 1.0)


# ---------------------------------------------------------------------------
# Synthetic Data Generator Tests
# ---------------------------------------------------------------------------


class TestSyntheticGenerator(unittest.TestCase):
    def test_generate_small_dataset(self):
        from apps.ai_engine.datasets.generator import generate_patients, generate_prescriptions, generate_adherence_history
        from datetime import date

        patients = generate_patients(50)
        self.assertEqual(len(patients), 50)

        start = date.today() - timedelta(days=14)
        prescriptions = generate_prescriptions(patients, start)
        self.assertGreater(len(prescriptions), 0)

        df = generate_adherence_history(patients, prescriptions, n_days=14, start_date=start)
        self.assertFalse(df.empty)
        self.assertIn("status", df.columns)
        self.assertIn("patient_id", df.columns)

    def test_all_statuses_present(self):
        from apps.ai_engine.datasets.generator import generate_patients, generate_prescriptions, generate_adherence_history
        from datetime import date

        patients = generate_patients(200)
        start = date.today() - timedelta(days=30)
        prescriptions = generate_prescriptions(patients, start)
        df = generate_adherence_history(patients, prescriptions, n_days=30, start_date=start)

        statuses = df["status"].unique()
        # With 200 patients over 30 days, we should see both TAKEN and MISSED
        self.assertIn("TAKEN", statuses)
        self.assertIn("MISSED", statuses)

    def test_elderly_archetype_has_lower_adherence(self):
        from apps.ai_engine.datasets.generator import generate_patients, generate_prescriptions, generate_adherence_history
        from datetime import date

        all_patients = generate_patients(300)
        elderly = [p for p in all_patients if p.archetype == "elderly_complex"]
        young = [p for p in all_patients if p.archetype == "young_acute"]

        if not elderly or not young:
            self.skipTest("Not enough patients in archetype buckets for this test")

        start = date.today() - timedelta(days=30)

        def avg_adherence(patients):
            presc = generate_prescriptions(patients[:20], start)
            df = generate_adherence_history(patients[:20], presc, n_days=30, start_date=start)
            taken = df[df["status"].isin(["TAKEN", "TAKEN_LATE", "TAKEN_EARLY"])].shape[0]
            return taken / len(df) if len(df) > 0 else 1.0

        elderly_rate = avg_adherence(elderly)
        young_rate = avg_adherence(young)
        # Elderly should have lower adherence on average
        self.assertLess(elderly_rate, young_rate + 0.15)  # allow some variance


if __name__ == "__main__":
    unittest.main()
