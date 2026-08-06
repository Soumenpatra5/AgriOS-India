import { lazy, Suspense } from "react";
import { T } from "../theme/ThemeProvider.jsx";
import { useApp } from "../store/AppStore.jsx";
import BottomNav from "./BottomNav.jsx";
import { ToastHost, Spinner } from "../components/index.js";
import Icon from "../components/Icon.jsx";
import ErrorBoundary from "../components/ErrorBoundary.jsx";

/* Core screens loaded eagerly (always visible on every session) */
import Splash from "../pages/Splash.jsx";
import LanguageSelect from "../pages/LanguageSelect.jsx";
import Onboarding from "../pages/Onboarding.jsx";
import AuthFlow from "../pages/AuthFlow.jsx";
import Home from "../pages/Home.jsx";

/* Everything else lazy-loaded on first visit */
const AIHub              = lazy(() => import("../pages/AIHub.jsx"));
const Market             = lazy(() => import("../pages/Market.jsx"));
const Services           = lazy(() => import("../pages/Services.jsx"));
const Profile            = lazy(() => import("../pages/Profile.jsx"));
const Settings           = lazy(() => import("../pages/Settings.jsx"));
const Personalize        = lazy(() => import("../pages/Personalize.jsx"));
const FarmDetails        = lazy(() => import("../pages/FarmDetails.jsx"));
const Support            = lazy(() => import("../pages/Support.jsx"));
const Privacy            = lazy(() => import("../pages/Privacy.jsx"));
const Subscription       = lazy(() => import("../pages/Subscription.jsx"));
const Payments           = lazy(() => import("../pages/Payments.jsx"));
const Documents          = lazy(() => import("../pages/Documents.jsx"));
const Security           = lazy(() => import("../pages/Security.jsx"));
const Permissions        = lazy(() => import("../pages/Permissions.jsx"));
const About              = lazy(() => import("../pages/About.jsx"));
const FeatureDetail      = lazy(() => import("../pages/FeatureDetail.jsx"));
const AIChat             = lazy(() => import("../pages/AIChat.jsx"));
const WeatherDashboard   = lazy(() => import("../pages/WeatherDashboard.jsx"));
const FarmLocations      = lazy(() => import("../pages/FarmLocations.jsx"));
const NearbyServices     = lazy(() => import("../pages/NearbyServices.jsx"));
const MandiPrices        = lazy(() => import("../pages/MandiPrices.jsx"));
const SchemeExplorer     = lazy(() => import("../pages/SchemeExplorer.jsx"));
const FarmLedger         = lazy(() => import("../pages/FarmLedger.jsx"));
const CropCalendar       = lazy(() => import("../pages/CropCalendar.jsx"));
const DiagnosticsHome    = lazy(() => import("../pages/DiagnosticsHome.jsx"));
const DiagnosticFlow     = lazy(() => import("../pages/DiagnosticFlow.jsx"));
const DiagnosticResult   = lazy(() => import("../pages/DiagnosticResult.jsx"));
const DiagnosticHistory  = lazy(() => import("../pages/DiagnosticHistory.jsx"));
const FarmERPHub         = lazy(() => import("../pages/erp/FarmERPHub.jsx"));
const FarmProfiles       = lazy(() => import("../pages/erp/FarmProfiles.jsx"));
const LandManager        = lazy(() => import("../pages/erp/LandManager.jsx"));
const TaskManager        = lazy(() => import("../pages/erp/TaskManager.jsx"));
const InventoryManager   = lazy(() => import("../pages/erp/InventoryManager.jsx"));
const AssetManager       = lazy(() => import("../pages/erp/AssetManager.jsx"));
const EmployeeManager    = lazy(() => import("../pages/erp/EmployeeManager.jsx"));
const CRMManager         = lazy(() => import("../pages/erp/CRMManager.jsx"));
const ProductionDashboard = lazy(() => import("../pages/erp/ProductionDashboard.jsx"));
const ReportsCenter      = lazy(() => import("../pages/erp/ReportsCenter.jsx"));
const FarmAnalytics      = lazy(() => import("../pages/erp/FarmAnalytics.jsx"));
const AIInsights         = lazy(() => import("../pages/erp/AIInsights.jsx"));
const DeviceManager      = lazy(() => import("../pages/erp/DeviceManager.jsx"));
const PigManager         = lazy(() => import("../pages/livestock/PigManager.jsx"));
const SheepManager       = lazy(() => import("../pages/livestock/SheepManager.jsx"));
const VaccinationCalendar = lazy(() => import("../pages/livestock/VaccinationCalendar.jsx"));
const LivestockHub       = lazy(() => import("../pages/livestock/LivestockHub.jsx"));
const PoultryManager     = lazy(() => import("../pages/livestock/PoultryManager.jsx"));
const DairyManager       = lazy(() => import("../pages/livestock/DairyManager.jsx"));
const GoatManager        = lazy(() => import("../pages/livestock/GoatManager.jsx"));
const FishManager        = lazy(() => import("../pages/livestock/FishManager.jsx"));
const BeeManager         = lazy(() => import("../pages/livestock/BeeManager.jsx"));
const BusinessDashboard  = lazy(() => import("../pages/business/BusinessDashboard.jsx"));
const PLReport           = lazy(() => import("../pages/business/PLReport.jsx"));
const CashFlowPage       = lazy(() => import("../pages/business/CashFlowPage.jsx"));
const MarketplaceHub     = lazy(() => import("../pages/marketplace/MarketplaceHub.jsx"));
const ProductDetail      = lazy(() => import("../pages/marketplace/ProductDetail.jsx"));
const StoreView          = lazy(() => import("../pages/marketplace/StoreView.jsx"));
const CartPage           = lazy(() => import("../pages/marketplace/CartPage.jsx"));
const CheckoutPage       = lazy(() => import("../pages/marketplace/CheckoutPage.jsx"));
const MyOrdersPage       = lazy(() => import("../pages/marketplace/MyOrdersPage.jsx"));
const WishlistPage       = lazy(() => import("../pages/marketplace/WishlistPage.jsx"));
const SellerDashboard    = lazy(() => import("../pages/marketplace/SellerDashboard.jsx"));
const SvcMarketplaceHub  = lazy(() => import("../pages/svcMarketplace/ServiceMarketplaceHub.jsx"));
const SvcDetail          = lazy(() => import("../pages/svcMarketplace/ServiceDetail.jsx"));
const SvcProviderProfile = lazy(() => import("../pages/svcMarketplace/ProviderProfile.jsx"));
const SvcBookingPage     = lazy(() => import("../pages/svcMarketplace/BookingPage.jsx"));
const SvcMyBookings      = lazy(() => import("../pages/svcMarketplace/MyBookingsPage.jsx"));
const SvcProviderDash    = lazy(() => import("../pages/svcMarketplace/ProviderDashboard.jsx"));
const LogisticsHub       = lazy(() => import("../pages/logistics/LogisticsHub.jsx"));
const ShipmentsPage      = lazy(() => import("../pages/logistics/ShipmentsPage.jsx"));
const ShipmentDetail     = lazy(() => import("../pages/logistics/ShipmentDetail.jsx"));
const FleetDashboard     = lazy(() => import("../pages/logistics/FleetDashboard.jsx"));
const WarehousePage      = lazy(() => import("../pages/logistics/WarehousePage.jsx"));
const ContractsPage      = lazy(() => import("../pages/logistics/ContractsPage.jsx"));
const AuctionPage        = lazy(() => import("../pages/logistics/AuctionPage.jsx"));
const ProcurementPage    = lazy(() => import("../pages/logistics/ProcurementPage.jsx"));
const ExportPage         = lazy(() => import("../pages/logistics/ExportPage.jsx"));
const LogisticsAnalytics = lazy(() => import("../pages/logistics/LogisticsAnalytics.jsx"));
const AICommerceHub      = lazy(() => import("../pages/aiCommerce/AICommerceHub.jsx"));
const RecommendationsPage  = lazy(() => import("../pages/aiCommerce/RecommendationsPage.jsx"));
const PriceIntelligencePage = lazy(() => import("../pages/aiCommerce/PriceIntelligencePage.jsx"));
const ForecastPage       = lazy(() => import("../pages/aiCommerce/ForecastPage.jsx"));
const MatchmakingPage    = lazy(() => import("../pages/aiCommerce/MatchmakingPage.jsx"));
const FraudRiskPage      = lazy(() => import("../pages/aiCommerce/FraudRiskPage.jsx"));
const AICommerceBI       = lazy(() => import("../pages/aiCommerce/BusinessIntelligencePage.jsx"));
const MLOpsHub           = lazy(() => import("../pages/mlops/MLOpsHub.jsx"));
const DatasetBrowser     = lazy(() => import("../pages/mlops/DatasetBrowser.jsx"));
const DatasetDetail      = lazy(() => import("../pages/mlops/DatasetDetail.jsx"));
const AnnotationWorkspace = lazy(() => import("../pages/mlops/AnnotationWorkspace.jsx"));
const ModelRegistryPage  = lazy(() => import("../pages/mlops/ModelRegistryPage.jsx"));
const ExperimentList     = lazy(() => import("../pages/mlops/ExperimentList.jsx"));
const TrainingDashboard  = lazy(() => import("../pages/mlops/TrainingDashboard.jsx"));
const MonitoringDashboard = lazy(() => import("../pages/mlops/MonitoringDashboard.jsx"));
const ApiKeyManager       = lazy(() => import("../pages/ApiKeyManager.jsx"));
const StorageManager      = lazy(() => import("../pages/StorageManager.jsx"));

const TAB_SCREENS = { home: Home, ai: AIHub, market: Market, services: Services, profile: Profile };

function LazyFallback() {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: 200 }}>
      <Spinner size={28} />
    </div>
  );
}

function StackScreen({ item }) {
  if (item.kind === "settings") return <Settings />;
  if (item.kind === "personalize") return <Personalize />;
  if (item.kind === "farmDetails") return <FarmDetails />;
  if (item.kind === "support") return <Support />;
  if (item.kind === "privacy") return <Privacy />;
  if (item.kind === "subscription") return <Subscription />;
  if (item.kind === "payments") return <Payments />;
  if (item.kind === "documents") return <Documents />;
  if (item.kind === "security") return <Security />;
  if (item.kind === "permissions") return <Permissions />;
  if (item.kind === "about") return <About />;
  if (item.kind === "feature") return <FeatureDetail {...item.props} />;
  if (item.kind === "chat") return <AIChat {...item.props} />;
  if (item.kind === "weather") return <WeatherDashboard />;
  if (item.kind === "farmLocations") return <FarmLocations />;
  if (item.kind === "nearby") return <NearbyServices />;
  if (item.kind === "mandiPrices") return <MandiPrices />;
  if (item.kind === "schemeExplorer") return <SchemeExplorer />;
  if (item.kind === "farmLedger") return <FarmLedger />;
  if (item.kind === "cropCalendar")      return <CropCalendar />;
  if (item.kind === "diagnosticsHome")   return <DiagnosticsHome />;
  if (item.kind === "diagnosticFlow")    return <DiagnosticFlow    {...(item.props || {})} />;
  if (item.kind === "diagnosticResult")  return <DiagnosticResult  {...(item.props || {})} />;
  if (item.kind === "diagnosticHistory") return <DiagnosticHistory />;
  if (item.kind === "diagnosticConsent")    return <DiagnosticsHome />;
  if (item.kind === "farmErp")              return <FarmERPHub />;
  if (item.kind === "farmProfiles")         return <FarmProfiles />;
  if (item.kind === "landManager")          return <LandManager />;
  if (item.kind === "erpTasks")             return <TaskManager />;
  if (item.kind === "erpInventory")         return <InventoryManager />;
  if (item.kind === "erpAssets")            return <AssetManager />;
  if (item.kind === "erpEmployees")         return <EmployeeManager />;
  if (item.kind === "erpCrm")               return <CRMManager />;
  if (item.kind === "erpProduction")        return <ProductionDashboard />;
  if (item.kind === "erpReports")           return <ReportsCenter />;
  if (item.kind === "erpAnalytics")         return <FarmAnalytics />;
  if (item.kind === "erpInsights")          return <AIInsights />;
  if (item.kind === "erpDevices")           return <DeviceManager />;
  if (item.kind === "pigManager")           return <PigManager />;
  if (item.kind === "sheepManager")         return <SheepManager />;
  if (item.kind === "vaccinationCalendar")  return <VaccinationCalendar />;
  if (item.kind === "livestockHub")         return <LivestockHub />;
  if (item.kind === "poultryManager")       return <PoultryManager />;
  if (item.kind === "dairyManager")         return <DairyManager />;
  if (item.kind === "goatManager")          return <GoatManager />;
  if (item.kind === "fishManager")          return <FishManager />;
  if (item.kind === "beeManager")           return <BeeManager />;
  if (item.kind === "businessDashboard")    return <BusinessDashboard />;
  if (item.kind === "plReport")             return <PLReport />;
  if (item.kind === "cashFlow")             return <CashFlowPage />;
  if (item.kind === "marketplace")          return <MarketplaceHub      {...(item.props || {})} />;
  if (item.kind === "mpProduct")            return <ProductDetail       {...(item.props || {})} />;
  if (item.kind === "mpStore")              return <StoreView           {...(item.props || {})} />;
  if (item.kind === "mpCart")               return <CartPage />;
  if (item.kind === "mpCheckout")           return <CheckoutPage />;
  if (item.kind === "mpOrders")             return <MyOrdersPage />;
  if (item.kind === "mpWishlist")           return <WishlistPage />;
  if (item.kind === "mpSeller")             return <SellerDashboard />;
  if (item.kind === "svcMarketplace")       return <SvcMarketplaceHub   {...(item.props || {})} />;
  if (item.kind === "svcDetail")            return <SvcDetail           {...(item.props || {})} />;
  if (item.kind === "svcProvider")          return <SvcProviderProfile  {...(item.props || {})} />;
  if (item.kind === "svcBooking")           return <SvcBookingPage      {...(item.props || {})} />;
  if (item.kind === "svcMyBookings")        return <SvcMyBookings />;
  if (item.kind === "svcProviderDash")      return <SvcProviderDash />;
  if (item.kind === "logisticsHub")         return <LogisticsHub />;
  if (item.kind === "logShipments")         return <ShipmentsPage />;
  if (item.kind === "logShipmentDetail")    return <ShipmentDetail      {...(item.props || {})} />;
  if (item.kind === "logFleet")             return <FleetDashboard />;
  if (item.kind === "logWarehouse")         return <WarehousePage />;
  if (item.kind === "logContracts")         return <ContractsPage />;
  if (item.kind === "logAuctions")          return <AuctionPage />;
  if (item.kind === "logProcurement")       return <ProcurementPage />;
  if (item.kind === "logExport")            return <ExportPage />;
  if (item.kind === "logAnalytics")         return <LogisticsAnalytics />;
  if (item.kind === "aiCommerceHub")        return <AICommerceHub />;
  if (item.kind === "aiRecs")               return <RecommendationsPage />;
  if (item.kind === "aiPricing")            return <PriceIntelligencePage />;
  if (item.kind === "aiForecast")           return <ForecastPage />;
  if (item.kind === "aiMatch")              return <MatchmakingPage />;
  if (item.kind === "aiFraud")              return <FraudRiskPage />;
  if (item.kind === "aiBI")                 return <AICommerceBI />;
  if (item.kind === "mlopsHub")             return <MLOpsHub />;
  if (item.kind === "datasetBrowser")       return <DatasetBrowser />;
  if (item.kind === "datasetDetail")        return <DatasetDetail       {...(item.props || {})} />;
  if (item.kind === "annotationWorkspace")  return <AnnotationWorkspace {...(item.props || {})} />;
  if (item.kind === "modelRegistryPage")    return <ModelRegistryPage />;
  if (item.kind === "experimentList")       return <ExperimentList />;
  if (item.kind === "trainingDashboard")    return <TrainingDashboard />;
  if (item.kind === "monitoringDashboard")  return <MonitoringDashboard />;
  if (item.kind === "apiKeyManager")        return <ApiKeyManager />;
  if (item.kind === "storage")              return <StorageManager />;
  return null;
}

function OfflineBar({ tc }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      padding: "6px 12px", background: T.orange, color: "#fff", fontSize: 12, fontWeight: 600 }}>
      <Icon name="WifiOff" size={14} />
      {tc({ en: "You're offline — data saved locally", hi: "आप ऑफ़लाइन हैं — डेटा लोकली सेव है", bn: "আপনি অফলাইনে আছেন — ডেটা স্থানীয়ভাবে সংরক্ষিত" })}
    </div>
  );
}

export default function ScreenRouter() {
  const { stage, tab, stack, online, tc, pop, switchTab } = useApp();

  if (stage !== "app") {
    const Flow = { splash: Splash, language: LanguageSelect, onboarding: Onboarding, auth: AuthFlow }[stage] || Splash;
    return (
      <div style={{ maxWidth: 460, margin: "0 auto", minHeight: "100vh", background: T.bg }}>
        {!online && <OfflineBar tc={tc} />}
        <Flow />
        <ToastHost />
      </div>
    );
  }

  const TabScreen = TAB_SCREENS[tab] || Home;
  const top = stack[stack.length - 1];
  // A crash on a pushed screen should pop back; a crash on a tab root resets to Home.
  const recover = () => (stack.length ? pop() : switchTab("home"));

  return (
    <div style={{ maxWidth: 460, margin: "0 auto", minHeight: "100vh", background: T.bg, position: "relative" }}>
      {!online && <OfflineBar tc={tc} />}
      <div style={{ paddingBottom: 84 }}>
        <ErrorBoundary variant="screen" resetKey={`${tab}:${stack.length}`} onReset={recover}>
          <Suspense fallback={<LazyFallback />}>
            {top
              ? <div key={stack.length} style={{ animation: "ag-push-in .26s var(--ag-ease)" }}><StackScreen item={top} /></div>
              : <div key={tab} style={{ animation: "ag-fade .22s var(--ag-ease)" }}><TabScreen /></div>}
          </Suspense>
        </ErrorBoundary>
      </div>
      <BottomNav />
      <ToastHost />
    </div>
  );
}
