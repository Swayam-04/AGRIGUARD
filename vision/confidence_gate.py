"""
AgriGuard — Multi-Tier Confidence & Safety Gating (Step 8 & Step 16)
===================================================================
Enforces the 3-tier threshold check (Leaf -> Crop -> Disease) and the
mandatory AgriGuard spray safety gate.
Guarantees that low confidence produces safe rejection instead of forced diagnosis.
"""

from typing import Dict, Any, Optional
from dataclasses import dataclass

from .plant_leaf_detector import LeafCandidate
from .crop_classifier import CropVerificationResult


@dataclass
class GatedDecision:
    status: str  # "DISEASE_RESULT", "HEALTHY", "LOW_CONFIDENCE", "UNSUPPORTED_CROP", "NO_VALID_LEAF"
    crop: Optional[str]
    disease: Optional[str]
    display_name: str
    confidence: float
    leaf_confidence: float
    crop_confidence: float
    is_healthy: bool
    spray_eligible: bool
    message: str
    rejection_reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "crop": self.crop,
            "disease": self.disease,
            "display_name": self.display_name,
            "confidence": round(self.confidence, 3),
            "leaf_confidence": round(self.leaf_confidence, 3),
            "crop_confidence": round(self.crop_confidence, 3),
            "is_healthy": self.is_healthy,
            "spray_eligible": self.spray_eligible,
            "message": self.message,
            "rejection_reason": self.rejection_reason
        }


class ConfidenceGate:
    """
    Evaluates leaf detection, crop verification, and pathology confidence
    against configurable safety thresholds.
    """

    def __init__(
        self,
        leaf_threshold: float = 0.50,
        crop_threshold: float = 0.60,
        disease_threshold: float = 0.60
    ):
        self.leaf_threshold = leaf_threshold
        self.crop_threshold = crop_threshold
        self.disease_threshold = disease_threshold

    def evaluate(
        self,
        leaf_candidate: LeafCandidate,
        crop_result: CropVerificationResult,
        disease_result: Dict[str, Any],
        human_in_frame: bool = False
    ) -> GatedDecision:
        """
        Enforces hierarchical threshold gating and spray safety lock.
        """
        leaf_conf = leaf_candidate.confidence
        crop_conf = crop_result.confidence
        disease_conf = disease_result.get("confidence", 0.0)
        is_healthy = disease_result.get("is_healthy", False)
        
        # Prefer the crop name from the disease result if it was explicitly modified (e.g. Weed override)
        crop_name = disease_result.get("crop", crop_result.crop_name)
        
        disease_name = disease_result.get("disease", "Unknown")

        # 1. Leaf Detection Confidence Gate
        if leaf_conf < self.leaf_threshold:
            return GatedDecision(
                status="NO_VALID_LEAF",
                crop=None,
                disease=None,
                display_name="Low-Confidence Leaf Detection",
                confidence=leaf_conf,
                leaf_confidence=leaf_conf,
                crop_confidence=crop_conf,
                is_healthy=False,
                spray_eligible=False,
                message="Unable to verify valid plant leaf structure with sufficient confidence.",
                rejection_reason="LEAF_CONFIDENCE_BELOW_THRESHOLD"
            )

        # 2. Supported Crop Check
        if not crop_result.supported:
            return GatedDecision(
                status=crop_result.status,
                crop=crop_name,
                disease=None,
                display_name=f"Unsupported Crop ({crop_name})",
                confidence=0.0,
                leaf_confidence=leaf_conf,
                crop_confidence=crop_conf,
                is_healthy=False,
                spray_eligible=False,
                message=crop_result.message,
                rejection_reason="UNSUPPORTED_CROP_SPECIES"
            )

        # 3. Crop Confidence Gate
        if crop_conf < self.crop_threshold:
            return GatedDecision(
                status="UNSUPPORTED_OR_UNCERTAIN",
                crop=crop_name,
                disease=None,
                display_name="Uncertain Crop Identification",
                confidence=crop_conf,
                leaf_confidence=leaf_conf,
                crop_confidence=crop_conf,
                is_healthy=False,
                spray_eligible=False,
                message="Unable to verify supported crop species with high confidence.",
                rejection_reason="CROP_CONFIDENCE_BELOW_THRESHOLD"
            )

        # 4. Disease Model Confidence Gate
        if disease_conf < self.disease_threshold:
            return GatedDecision(
                status="LOW_CONFIDENCE",
                crop=crop_name,
                disease=None,
                display_name="Low Confidence – Manual Inspection Required",
                confidence=disease_conf,
                leaf_confidence=leaf_conf,
                crop_confidence=crop_conf,
                is_healthy=False,
                spray_eligible=False,
                message="Unable to confidently identify disease. Please inspect manually.",
                rejection_reason="DISEASE_CONFIDENCE_BELOW_THRESHOLD"
            )

        # 5. Spray Safety Gate: Humans in Frame Check
        if human_in_frame:
            return GatedDecision(
                status="DISEASE_RESULT" if not is_healthy else "HEALTHY",
                crop=crop_name,
                disease="healthy" if is_healthy else disease_name,
                display_name=f"{crop_name} {disease_name} (Human in View – Spray Interlocked)",
                confidence=disease_conf,
                leaf_confidence=leaf_conf,
                crop_confidence=crop_conf,
                is_healthy=is_healthy,
                spray_eligible=False,  # Human safety interlock!
                message="Diagnosis established, but physical spraying is INTERLOCKED because a human is detected in frame.",
                rejection_reason="HUMAN_IN_FRAME_SAFETY_LOCK"
            )

        # 6. Healthy Foliage State
        if is_healthy:
            return GatedDecision(
                status="HEALTHY",
                crop=crop_name,
                disease="healthy",
                display_name=f"{crop_name} Healthy Foliage",
                confidence=disease_conf,
                leaf_confidence=leaf_conf,
                crop_confidence=crop_conf,
                is_healthy=True,
                spray_eligible=False,  # Healthy plants do not require chemical spray
                message=f"Optimal physiological vigor detected on {crop_name}. Zero intervention needed."
            )

        # 7. Actionable Disease Diagnosis
        return GatedDecision(
            status="DISEASE_RESULT",
            crop=crop_name,
            disease=disease_name,
            display_name=f"{crop_name} {disease_name}",
            confidence=disease_conf,
            leaf_confidence=leaf_conf,
            crop_confidence=crop_conf,
            is_healthy=False,
            spray_eligible=True,  # Eligible for treatment review + farmer approval
            message=f"{crop_name} {disease_name} identified with high confidence ({int(disease_conf * 100)}%). Ready for farmer review."
        )
