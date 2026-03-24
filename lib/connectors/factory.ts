/**
 * Connector Factory — все коннекторы Фазы 1 + 2
 * Импортировать в /api/connectors/[type]/auth и sync
 */

import { MoyskladConnector } from './moysklad'
import { CdekConnector } from './cdek'
import { BitrixConnector, YukassaConnector, TelegramConnector } from './other'
import {
  AmoCrmConnector,
  RetailCrmConnector,
  OneCConnector,
  YandexDeliveryConnector,
  SbpConnector,
  TinkoffConnector,
  UnisenderConnector,
  RoistatConnector,
  WhatsAppConnector,
} from './phase2'

export { MoyskladConnector }

export function getConnector(type: string) {
  switch (type) {
    // Фаза 1
    case 'moysklad':        return new MoyskladConnector()
    case 'cdek':            return new CdekConnector()
    case 'bitrix':          return new BitrixConnector()
    case 'yukassa':         return new YukassaConnector()
    case 'telegram':        return new TelegramConnector()
    // Фаза 2
    case 'amocrm':          return new AmoCrmConnector()
    case 'retailcrm':       return new RetailCrmConnector()
    case '1c':              return new OneCConnector()
    case 'yandex_delivery': return new YandexDeliveryConnector()
    case 'sbp':             return new SbpConnector()
    case 'tinkoff':         return new TinkoffConnector()
    case 'unisender':       return new UnisenderConnector()
    case 'roistat':         return new RoistatConnector()
    case 'whatsapp':        return new WhatsAppConnector()
    default:                return null
  }
}
