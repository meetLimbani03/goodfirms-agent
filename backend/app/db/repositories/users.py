from __future__ import annotations

from app.db.mysql import MySQLManager


class UserRepository:
    def __init__(self, mysql: MySQLManager) -> None:
        self._mysql = mysql

    def get_user_by_id(self, user_id: int) -> dict | None:
        sql = """
            SELECT
                id,
                name,
                email,
                company_name,
                position,
                location,
                company_website,
                public_url,
                google_id,
                social_id,
                is_goodfirms_registered,
                created,
                updated
            FROM users
            WHERE id = %s
            LIMIT 1
        """
        with self._mysql.connection.cursor() as cursor:
            cursor.execute(sql, (user_id,))
            return cursor.fetchone()
