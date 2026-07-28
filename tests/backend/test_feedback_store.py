import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from app.services import feedback_store  # noqa: E402


class FeedbackStorePrivacyTest(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_instance_dir = feedback_store.INSTANCE_DIR
        self.original_feedback_file = feedback_store.FEEDBACK_FILE
        feedback_store.INSTANCE_DIR = Path(self.temp_dir.name)
        feedback_store.FEEDBACK_FILE = feedback_store.INSTANCE_DIR / "feedback.json"

    def tearDown(self):
        feedback_store.INSTANCE_DIR = self.original_instance_dir
        feedback_store.FEEDBACK_FILE = self.original_feedback_file
        self.temp_dir.cleanup()

    def test_no_consent_record_does_not_create_vision_analysis_fields(self):
        saved = feedback_store.save_feedback({
            "id": "FB-no-consent",
            "notes": "keep note only",
            "customer_code": "KH-1"
        })

        self.assertNotIn("confidence", saved)
        self.assertNotIn("confidence_level", saved)
        self.assertNotIn("top_candidates", saved)
        self.assertNotIn("capture_quality", saved)
        self.assertNotIn("diagnostics", saved)
        self.assertEqual(saved["notes"], "keep note only")

    def test_consent_record_keeps_allowed_vision_analysis_fields(self):
        saved = feedback_store.save_feedback({
            "id": "FB-consent",
            "confidence": 0.82,
            "confidence_level": "high",
            "top_candidates": [{"shape": "oval"}],
            "capture_quality": {"passed": True},
            "diagnostics": {"scanMode": "center-burst-primary"}
        })

        self.assertEqual(saved["confidence"], 0.82)
        self.assertEqual(saved["confidence_level"], "high")
        self.assertEqual(saved["top_candidates"], [{"shape": "oval"}])
        self.assertEqual(saved["capture_quality"], {"passed": True})
        self.assertEqual(saved["diagnostics"], {"scanMode": "center-burst-primary"})


if __name__ == "__main__":
    unittest.main()
