import { Product, Order, User, Seller } from '../types';

export interface ProductVelocityMetrics {
  product: Product;
  unitsSold: number;
  totalRevenue: number;
  uniqueClicks: number;
  favoritesCount: number;
  conversionRate: number; // Percentage
  daysOfInventoryRemaining: number;
  stockStatus: 'optimal' | 'critical_low' | 'out_of_stock' | 'overstocked' | 'stagnant';
  classification: 'champion' | 'cash_cow' | 'high_interest_untapped' | 'slow_moving_stagnant';
  recommendedAction: string;
}

export interface SalesAlgorithmDiagnostics {
  totalRevenue: number;
  totalUnitsSold: number;
  averageOrderValue: number;
  champions: ProductVelocityMetrics[];
  slowMoving: ProductVelocityMetrics[];
  highInterestUntapped: ProductVelocityMetrics[];
  outOfStockRisk: ProductVelocityMetrics[];
  forecastNext7Days: number;
  forecastNext30Days: number;
  growthRecommendations: {
    type: 'boost' | 'discount' | 'replenish' | 'scam_warning' | 'merchandise';
    title: string;
    description: string;
    productId?: string;
    urgency: 'high' | 'medium' | 'info';
  }[];
}

/**
 * Advanced AI Sales Management Engine
 * Implements automated inventory turnover velocity, BCG product matrix analysis,
 * conversion funnel tracking, demand forecasting, and automated growth heuristics.
 */
export function runSalesManagementAlgorithm(
  products: Product[],
  orders: Order[],
  users?: User[],
  sellers?: Seller[]
): SalesAlgorithmDiagnostics {
  const completedOrders = orders.filter(o => o.status !== 'cancelled');
  const totalRevenue = completedOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
  
  // Aggregate units sold and revenue per product
  const salesByProduct: Record<string, { units: number; revenue: number }> = {};
  
  completedOrders.forEach(o => {
    if (o.items && o.items.length > 0) {
      o.items.forEach(it => {
        const key = it.name?.trim().toLowerCase();
        if (key) {
          if (!salesByProduct[key]) salesByProduct[key] = { units: 0, revenue: 0 };
          salesByProduct[key].units += Number(it.quantity) || 1;
          salesByProduct[key].revenue += (Number(it.price) || 0) * (Number(it.quantity) || 1);
        }
      });
    } else if (o.product_name) {
      const key = o.product_name.trim().toLowerCase();
      if (!salesByProduct[key]) salesByProduct[key] = { units: 0, revenue: 0 };
      const qty = Number(o.quantity) || 1;
      salesByProduct[key].units += qty;
      salesByProduct[key].revenue += Number(o.price) || 0;
    }
  });

  const productMetrics: ProductVelocityMetrics[] = products.map(product => {
    const key = (product.name || '').trim().toLowerCase();
    const recordedSales = salesByProduct[key];
    const unitsSold = recordedSales ? recordedSales.units : (Number(product.sold) || 0);
    const totalRev = recordedSales ? recordedSales.revenue : (unitsSold * (product.price || 0));
    
    const uniqueClicks = product.clicks || 0;
    const favoritesCount = product.favorites_count || 0;
    
    // Conversion rate
    const totalInteractions = uniqueClicks + unitsSold;
    const conversionRate = totalInteractions > 0 
      ? Math.round((unitsSold / totalInteractions) * 100) 
      : 0;

    const currentStock = Number(product.stock) || 0;
    
    // Average daily sales velocity (estimated across past 30 days)
    const dailySalesRate = Math.max(0.1, unitsSold / 30);
    const daysOfInventoryRemaining = Math.round(currentStock / dailySalesRate);

    // Stock health
    let stockStatus: ProductVelocityMetrics['stockStatus'] = 'optimal';
    if (currentStock === 0) stockStatus = 'out_of_stock';
    else if (currentStock <= 5) stockStatus = 'critical_low';
    else if (unitsSold === 0 && currentStock > 30) stockStatus = 'stagnant';
    else if (daysOfInventoryRemaining > 120) stockStatus = 'overstocked';

    // Classification & Action
    let classification: ProductVelocityMetrics['classification'] = 'slow_moving_stagnant';
    let recommendedAction = '';

    if (unitsSold >= 5 || totalRev >= 5000) {
      classification = 'champion';
      recommendedAction = currentStock <= 5 
        ? 'Restock immediately! Fast selling item at risk of stockout.'
        : 'Feature on HOT DEAL banner & expand promotional reach.';
    } else if (uniqueClicks >= 5 && unitsSold <= 1) {
      classification = 'high_interest_untapped';
      recommendedAction = 'High buyer interest but low conversion. Test 10-15% discount or verify price parity.';
    } else if (unitsSold > 0) {
      classification = 'cash_cow';
      recommendedAction = 'Maintain steady catalog inventory & collect positive buyer reviews.';
    } else {
      classification = 'slow_moving_stagnant';
      recommendedAction = 'Zero sales recorded. Optimize SEO keywords, reduce price, or bundle to clear capital.';
    }

    return {
      product,
      unitsSold,
      totalRevenue: totalRev,
      uniqueClicks,
      favoritesCount,
      conversionRate,
      daysOfInventoryRemaining,
      stockStatus,
      classification,
      recommendedAction
    };
  });

  // Segregate lists
  const champions = [...productMetrics]
    .filter(p => p.classification === 'champion' || p.unitsSold > 0)
    .sort((a, b) => b.unitsSold - a.unitsSold);

  const slowMoving = [...productMetrics]
    .filter(p => p.unitsSold === 0 || p.classification === 'slow_moving_stagnant')
    .sort((a, b) => (b.product.stock || 0) - (a.product.stock || 0));

  const highInterestUntapped = [...productMetrics]
    .filter(p => p.classification === 'high_interest_untapped' || (p.uniqueClicks > 0 && p.unitsSold === 0))
    .sort((a, b) => b.uniqueClicks - a.uniqueClicks);

  const outOfStockRisk = [...productMetrics]
    .filter(p => p.stockStatus === 'critical_low' || p.stockStatus === 'out_of_stock')
    .sort((a, b) => a.product.stock! - b.product.stock!);

  const totalUnitsSold = productMetrics.reduce((acc, p) => acc + p.unitsSold, 0);
  const averageOrderValue = completedOrders.length > 0 ? Math.round(totalRevenue / completedOrders.length) : 0;

  // Predictive Demand Forecasting
  const dailyAverageRev = completedOrders.length > 0 ? (totalRevenue / 14) : 1200;
  const forecastNext7Days = Math.round(dailyAverageRev * 7 * 1.08); // 8% projected growth
  const forecastNext30Days = Math.round(dailyAverageRev * 30 * 1.15); // 15% projected expansion

  // Algorithmic Growth Recommendations
  const growthRecommendations: SalesAlgorithmDiagnostics['growthRecommendations'] = [];

  // 1. Champions recommendation
  if (champions.length > 0) {
    growthRecommendations.push({
      type: 'boost',
      title: `Promote Top Champion: ${champions[0].product.name}`,
      description: `Has achieved ${champions[0].unitsSold} verified sales with strong customer demand. Placing this in HOT DEAL will multiply orders.`,
      productId: champions[0].product.id,
      urgency: 'high'
    });
  }

  // 2. Slow-moving inventory liquidation
  if (slowMoving.length > 0) {
    const topStagnant = slowMoving[0];
    growthRecommendations.push({
      type: 'discount',
      title: `Liquidate Stagnant Inventory: ${topStagnant.product.name}`,
      description: `Currently sitting on ${topStagnant.product.stock || 0} unsold units. Apply a temporary 15% discount to unlock frozen liquidity.`,
      productId: topStagnant.product.id,
      urgency: 'medium'
    });
  }

  // 3. Stock replenishment alert
  if (outOfStockRisk.length > 0) {
    const atRisk = outOfStockRisk[0];
    growthRecommendations.push({
      type: 'replenish',
      title: `Low Stock Depletion Alert: ${atRisk.product.name}`,
      description: `Available inventory is down to ${atRisk.product.stock || 0} units. Reorder within 48 hours to prevent losing orders.`,
      productId: atRisk.product.id,
      urgency: 'high'
    });
  }

  // 4. Untapped interest
  if (highInterestUntapped.length > 0) {
    const untapped = highInterestUntapped[0];
    growthRecommendations.push({
      type: 'merchandise',
      title: `Convert High Interest: ${untapped.product.name}`,
      description: `Customers visited this product ${untapped.uniqueClicks} times without checking out. Improving photos or adding free delivery will trigger conversion.`,
      productId: untapped.product.id,
      urgency: 'info'
    });
  }

  return {
    totalRevenue,
    totalUnitsSold,
    averageOrderValue,
    champions,
    slowMoving,
    highInterestUntapped,
    outOfStockRisk,
    forecastNext7Days,
    forecastNext30Days,
    growthRecommendations
  };
}
