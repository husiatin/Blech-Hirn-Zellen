from typing import Optional
import logging

from .models import NotificationData
from .game import players


async def set_webhook_url_for_player(player_id: str, webhook_url: str) -> None:
    # TODO: store webhook_url for the given player (attach to player model or a registry)
    logging.debug("set_webhook_url_for_player called for %s -> %s", player_id, webhook_url)
    return None


async def webhook_notification(notification_data: NotificationData) -> None:
    # TODO: send notification to registered webhooks for players
    logging.debug("webhook_notification called: %s", notification_data)
    return None
