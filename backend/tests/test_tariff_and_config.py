from decimal import Decimal

import pytest

from app.services.tariff import (
    calculate_tiered_electric,
    calculate_utility_total,
    calculate_water_cost,
)
from scripts.reset_test_db import _parse_db_urls


def test_tiered_tariff_matches_sp1():
    assert calculate_tiered_electric(0) == Decimal("0.00")
    assert calculate_tiered_electric(100) == Decimal("200000.00")
    assert calculate_tiered_electric(150) == Decimal("325000.00")
    assert calculate_tiered_electric(200) == Decimal("450000.00")
    assert calculate_tiered_electric(250) == Decimal("600000.00")
    assert calculate_water_cost(15) == Decimal("150000.00")
    assert calculate_utility_total(250, 15) == Decimal("750000.00")


def test_tiered_tariff_rejects_negative_usage():
    with pytest.raises(ValueError):
        calculate_utility_total(-1, 10)
    with pytest.raises(ValueError):
        calculate_utility_total(10, -1)


def test_parse_db_urls_derives_admin_from_settings_url():
    admin_url, db_name, test_url = _parse_db_urls(
        "postgresql://u:p@dbhost:5433/my_test_db"
    )
    assert db_name == "my_test_db"
    assert admin_url == "postgresql://u:p@dbhost:5433/postgres"
    assert test_url == "postgresql://u:p@dbhost:5433/my_test_db"
