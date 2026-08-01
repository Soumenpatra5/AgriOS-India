/* Agent registry — the single place agents are registered and looked up. */

import generalAssistant from "./definitions/generalAssistant.js";
import farmDoctor from "./definitions/farmDoctor.js";
import cropExpert from "./definitions/cropExpert.js";
import livestockExpert from "./definitions/livestockExpert.js";
import businessAdvisor from "./definitions/businessAdvisor.js";
import loanAdvisor from "./definitions/loanAdvisor.js";
import governmentAdvisor from "./definitions/governmentAdvisor.js";
import weatherExpert from "./definitions/weatherExpert.js";
import marketExpert from "./definitions/marketExpert.js";
import financeExpert from "./definitions/financeExpert.js";
import veterinaryExpert from "./definitions/veterinaryExpert.js";
import educationExpert from "./definitions/educationExpert.js";
import commerceAdvisor from "./definitions/commerceAdvisor.js";
import dprGenerator from "./definitions/dprGenerator.js";

const AGENTS = [
  generalAssistant, farmDoctor, cropExpert, livestockExpert, businessAdvisor,
  loanAdvisor, governmentAdvisor, weatherExpert, marketExpert, financeExpert,
  veterinaryExpert, educationExpert, commerceAdvisor, dprGenerator,
];

const byId = new Map(AGENTS.map((a) => [a.id, a]));

export const listAgents = () => AGENTS;
export const getAgent = (id) => byId.get(id) || generalAssistant;
export const DEFAULT_AGENT_ID = generalAssistant.id;
