from typing import Dict, List

SCHEMES: List[Dict[str, object]] = [
    {
        "name": "PM Kisan Samman Nidhi",
        "description": "Income support for eligible farmer families.",
        "occupation": ["farmer"],
        "income_brackets": ["low", "medium"],
        "age_groups": ["adult", "senior"],
        "genders": ["m", "f", "other"],
        "source": "myScheme",
    },
    {
        "name": "National Scholarship Portal Schemes",
        "description": "Scholarships for eligible students.",
        "occupation": ["student"],
        "income_brackets": ["low", "medium"],
        "age_groups": ["youth", "adult"],
        "genders": ["m", "f", "other"],
        "source": "myScheme",
    },
    {
        "name": "Ayushman Bharat PM-JAY",
        "description": "Health coverage support for low income families.",
        "occupation": ["student", "farmer", "govt employee", "other"],
        "income_brackets": ["low"],
        "age_groups": ["youth", "adult", "senior"],
        "genders": ["m", "f", "other"],
        "source": "myScheme",
    },
    {
        "name": "Atal Pension Yojana",
        "description": "Pension scheme for workers in unorganized sector.",
        "occupation": ["farmer", "other"],
        "income_brackets": ["low", "medium"],
        "age_groups": ["adult"],
        "genders": ["m", "f", "other"],
        "source": "myScheme",
    },
    {
        "name": "Senior Citizen Welfare Assistance",
        "description": "Support for eligible senior citizens.",
        "occupation": ["farmer", "govt employee", "other"],
        "income_brackets": ["low", "medium", "high"],
        "age_groups": ["senior"],
        "genders": ["m", "f", "other"],
        "source": "seeded-demo",
    },
]


def map_age_range_to_group(age_range_choice: str) -> str:
    return {
        "1": "youth",   # <= 17
        "2": "youth",   # 18-35
        "3": "adult",   # 36-59
        "4": "senior",  # 60+
    }.get(age_range_choice, "adult")


def map_income_range_to_group(income_choice: str) -> str:
    return {
        "1": "low",     # below 2L
        "2": "medium",  # 2L-5L
        "3": "high",    # above 5L
    }.get(income_choice, "medium")


def map_gender_choice(gender_choice: str) -> str:
    return {
        "1": "m",
        "2": "f",
        "3": "other",
    }.get(gender_choice, "other")


def map_occupation_choice(occupation_choice: str) -> str:
    return {
        "1": "student",
        "2": "farmer",
        "3": "govt employee",
        "4": "other",
    }.get(occupation_choice, "other")


def get_relevant_schemes(
    age_range_choice: str,
    gender_choice: str,
    income_choice: str,
    occupation_choice: str,
    limit: int = 3,
) -> List[Dict[str, object]]:
    age_group = map_age_range_to_group(age_range_choice)
    income_group = map_income_range_to_group(income_choice)
    gender = map_gender_choice(gender_choice)
    occupation = map_occupation_choice(occupation_choice)

    matched = []
    for scheme in SCHEMES:
        if occupation not in scheme["occupation"]:
            continue
        if income_group not in scheme["income_brackets"]:
            continue
        if age_group not in scheme["age_groups"]:
            continue
        if gender not in scheme["genders"]:
            continue
        matched.append(scheme)

    if not matched:
        # fallback: at least occupation-level recommendations
        for scheme in SCHEMES:
            if occupation in scheme["occupation"]:
                matched.append(scheme)

    return matched[:limit]
