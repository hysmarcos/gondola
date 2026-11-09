// Entrada del content script aislado (document_start, para no perder mensajes).
import { installBadges } from "./badge.js";

installBadges(window, document);
