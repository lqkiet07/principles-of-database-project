from decimal import Decimal

TIER1_LIMIT = 100
TIER2_LIMIT = 200
TIER1_RATE = Decimal("2000.00")
TIER2_RATE = Decimal("2500.00")
TIER3_RATE = Decimal("3000.00")
WATER_RATE = Decimal("10000.00")


def calculate_tiered_electric(delta_kwh: int) -> Decimal:
    """Compute progressive 3-tier electricity cost matching SP1."""
    if delta_kwh < 0:
        raise ValueError("Electricity consumption delta must be non-negative.")
    if delta_kwh <= TIER1_LIMIT:
        cost = Decimal(delta_kwh) * TIER1_RATE
    elif delta_kwh <= TIER2_LIMIT:
        cost = (Decimal(TIER1_LIMIT) * TIER1_RATE) + (
            Decimal(delta_kwh - TIER1_LIMIT) * TIER2_RATE
        )
    else:
        cost = (
            (Decimal(TIER1_LIMIT) * TIER1_RATE)
            + (Decimal(TIER2_LIMIT - TIER1_LIMIT) * TIER2_RATE)
            + (Decimal(delta_kwh - TIER2_LIMIT) * TIER3_RATE)
        )
    return cost.quantize(Decimal("0.01"))


def calculate_water_cost(delta_m3: int) -> Decimal:
    """Compute flat water cost matching SP1."""
    if delta_m3 < 0:
        raise ValueError("Water consumption delta must be non-negative.")
    return (Decimal(delta_m3) * WATER_RATE).quantize(Decimal("0.01"))


def calculate_utility_total(delta_kwh: int, delta_m3: int) -> Decimal:
    """Compute total combined electricity and water utility bill."""
    return (
        calculate_tiered_electric(delta_kwh) + calculate_water_cost(delta_m3)
    ).quantize(Decimal("0.01"))
