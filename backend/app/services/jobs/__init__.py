from arq import create_pool
from arq.connections import RedisSettings
from app.config import settings
import urllib.parse


def _redis_settings() -> RedisSettings:
    parsed = urllib.parse.urlparse(settings.redis_url)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        password=parsed.password,
    )


async def get_arq_pool():
    return await create_pool(_redis_settings())
