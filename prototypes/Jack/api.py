import json
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request

app = Flask(__name__)

DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "Password123!"
DEMO_ACCESS_TOKEN = "demo-access-token"
DB_PATH = Path(__file__).with_name("database.json")


def _default_database() -> dict[str, Any]:
	return {
		"users": [
			{
				"userId": "00000000-0000-0000-0000-000000000001",
				"email": DEMO_EMAIL,
				"password": DEMO_PASSWORD,
			}
		],
		"profile": {
			"userId": "00000000-0000-0000-0000-000000000001",
			"email": DEMO_EMAIL,
			"userType": 0,
			"firstName": "Demo",
			"lastName": "User",
			"city": "Boston",
			"state": "Massachusetts",
			"country": "United States",
			"zipCode": "02110",
			"dob": "1990-04-12",
		},
		"portfolios": [
			{
				"portfolioId": "00000000-0000-0000-0000-000000000010",
				"userId": "00000000-0000-0000-0000-000000000001",
				"portfolioName": "Main Portfolio",
			}
		],
	}


def _save_database(db: dict[str, Any]) -> None:
	DB_PATH.write_text(json.dumps(db, indent=2), encoding="utf-8")


def _load_database() -> dict[str, Any]:
	if not DB_PATH.exists() or DB_PATH.stat().st_size == 0:
		db = _default_database()
		_save_database(db)
		return db

	with DB_PATH.open("r", encoding="utf-8") as db_file:
		try:
			db = json.load(db_file)
		except json.JSONDecodeError:
			db = _default_database()
			_save_database(db)
			return db

	if "users" not in db or "profile" not in db or "portfolios" not in db:
		db = _default_database()
		_save_database(db)

	return db


def _extract_bearer_token() -> str | None:
	auth_header = request.headers.get("Authorization", "")
	if not auth_header.startswith("Bearer "):
		return None
	return auth_header.removeprefix("Bearer ").strip()


def _require_auth():
	token = _extract_bearer_token()
	if token != DEMO_ACCESS_TOKEN:
		return jsonify({"message": "Unauthorized"}), 401
	return None


@app.post("/auth/login")
def login():
	db = _load_database()
	body = request.get_json(silent=True) or {}
	email = body.get("email")
	password = body.get("password")

	user = next((candidate for candidate in db["users"] if candidate["email"] == email), None)
	if not user or user["password"] != password:
		return jsonify({"message": "Invalid credentials"}), 401

	return jsonify(
		{
			"accessToken": DEMO_ACCESS_TOKEN,
			"refreshToken": "demo-refresh-token",
		}
	)


@app.get("/api/profile")
def get_profile():
	unauthorized = _require_auth()
	if unauthorized:
		return unauthorized

	db = _load_database()
	profile_store = db.get("profile")

	if profile_store is None:
		return jsonify({"message": "Profile not found"}), 404

	return jsonify(profile_store)


@app.post("/api/profile")
def create_profile():
	unauthorized = _require_auth()
	if unauthorized:
		return unauthorized

	db = _load_database()
	profile_store = db.get("profile")

	body = request.get_json(silent=True) or {}
	first_name = body.get("firstName")
	last_name = body.get("lastName")

	if not first_name or not last_name:
		return (
			jsonify(
				{
					"message": "Validation failed",
					"details": {
						"firstName": "firstName is required",
						"lastName": "lastName is required",
					},
				}
			),
			400,
		)

	profile_store.update(
		{
			"firstName": first_name,
			"lastName": last_name,
			"city": body.get("city"),
			"state": body.get("state"),
			"country": body.get("country"),
			"zipCode": body.get("zipCode"),
			"dob": body.get("dob"),
		}
	)
	db["profile"] = profile_store
	_save_database(db)

	return jsonify(profile_store), 201


@app.get("/api/portfolios")
def get_portfolios():
	unauthorized = _require_auth()
	if unauthorized:
		return unauthorized

	db = _load_database()
	return jsonify(db["portfolios"])


@app.post("/api/portfolios")
def create_portfolio():
	unauthorized = _require_auth()
	if unauthorized:
		return unauthorized

	db = _load_database()
	body = request.get_json(silent=True) or {}
	portfolio_name = body.get("portfolioName")

	if not portfolio_name:
		return (
			jsonify(
				{
					"message": "Validation failed",
					"details": {"portfolioName": "portfolioName is required"},
				}
			),
			400,
		)

	next_id = f"demo-portfolio-{len(db['portfolios']) + 1:03d}"
	portfolio = {
		"portfolioId": next_id,
		"userId": db["profile"]["userId"],
		"portfolioName": portfolio_name,
	}
	db["portfolios"].append(portfolio)
	_save_database(db)

	return jsonify(portfolio), 201


if __name__ == "__main__":
	app.run(host="0.0.0.0", port=5000, debug=True)