"""
Translation Service
===================
Provides robust, low-latency translation for AI engine outputs.
Includes caching, fallback to English, and medical term dictionary.
"""

import hashlib
import logging
from typing import Dict, List, Union

from django.core.cache import cache
from deep_translator import GoogleTranslator

logger = logging.getLogger("medadhere.ai_engine.translation")

# Medical terms dictionary to prevent incorrect literal translations.
# These will be replaced in the text before sending to the external API,
# or we can do post-processing. A simple approach is replacing known phrases
# but it's often better to let the API handle the full sentence context,
# unless it's a critical domain term that translates poorly.
# Since deep-translator wraps Google Translate, it usually handles medical context well.
# We'll keep this dictionary for specific programmatic terms if needed.
MEDICAL_DICT_HI = {
    "Adherence": "दवा का पालन",
    "Non-adherence": "दवा का पालन न करना",
    "Caregiver": "देखभाल करने वाला",
    "Refill": "दवा का रीफिल",
    "Dose": "खुराक",
}

class TranslationService:
    """
    Handles translation of AI insights, recommendations, and alerts.
    """
    
    CACHE_TIMEOUT = 86400 * 30  # 30 days cache for static strings

    @classmethod
    def _generate_cache_key(cls, text: str, target_lang: str) -> str:
        """Generate a stable cache key for a translation."""
        text_hash = hashlib.md5(text.encode("utf-8")).hexdigest()
        return f"ai_translation_{target_lang}_{text_hash}"

    @classmethod
    def translate_text(cls, text: str, target_lang: str = "en") -> str:
        """
        Translate a single string.
        Falls back to original text if translation fails.
        """
        if not text or target_lang == "en":
            return text

        if target_lang not in ["hi", "en"]:
            logger.warning(f"Unsupported language requested: {target_lang}. Falling back to 'en'.")
            return text

        cache_key = cls._generate_cache_key(text, target_lang)
        cached_translation = cache.get(cache_key)
        
        if cached_translation:
            return cached_translation

        try:
            # Perform translation
            translator = GoogleTranslator(source="en", target=target_lang)
            translated = translator.translate(text)
            
            if translated:
                cache.set(cache_key, translated, cls.CACHE_TIMEOUT)
                return translated
            return text
            
        except Exception as e:
            logger.error(f"Translation failed for target={target_lang}: {e}")
            # Fallback to English
            return text

    @classmethod
    def batch_translate(cls, texts: List[str], target_lang: str = "en") -> List[str]:
        """
        Translate a list of strings efficiently.
        Returns the original strings on failure.
        """
        if not texts or target_lang == "en":
            return texts
            
        if target_lang not in ["hi", "en"]:
            return texts

        results = []
        texts_to_translate = []
        indices_to_translate = []

        # Check cache first
        for i, text in enumerate(texts):
            cache_key = cls._generate_cache_key(text, target_lang)
            cached = cache.get(cache_key)
            if cached:
                results.append(cached)
            else:
                results.append(text)  # Placeholder
                texts_to_translate.append(text)
                indices_to_translate.append(i)

        if not texts_to_translate:
            return results

        try:
            # Batch translate the remaining texts
            # deep_translator supports batch translation via list mapping
            translator = GoogleTranslator(source="en", target=target_lang)
            # Depending on deep_translator version, translate_batch might be available.
            # Using translate_batch is safer.
            translated_batch = translator.translate_batch(texts_to_translate)
            
            for i, idx in enumerate(indices_to_translate):
                translated_text = translated_batch[i]
                if translated_text:
                    results[idx] = translated_text
                    # Cache the new translation
                    cache_key = cls._generate_cache_key(texts_to_translate[i], target_lang)
                    cache.set(cache_key, translated_text, cls.CACHE_TIMEOUT)

        except Exception as e:
            logger.error(f"Batch translation failed for target={target_lang}: {e}")
            # The placeholders (original texts) are already in results, so it safely falls back
            
        return results
