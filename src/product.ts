import type { ListProducts, ListVariants } from "@lemonsqueezy/lemonsqueezy.js";
import type { Polar } from "@polar-sh/sdk";
import type {
	BenefitLicenseKeyExpirationProperties,
	Interval,
	Organization,
	ProductOneTimeCreate,
	ProductPriceOneTimeCustomCreate,
	ProductPriceOneTimeFixedCreate,
	ProductPriceOneTimeFreeCreate,
	ProductPriceRecurringFixedCreate,
	ProductPriceRecurringFreeCreate,
	ProductRecurringCreate,
	Timeframe,
} from "@polar-sh/sdk/models/components";

const resolveInterval = (
	interval: ListVariants["data"][number]["attributes"]["interval"],
): Interval => {
	switch (interval) {
		case "day":
			return "day";
		case "week":
			return "week";
		case "month":
			return "month";
		case "year":
			return "year";
		default:
			throw new Error(`Unknown interval: ${interval}`);
	}
};

const resolvePrice = (
	variant: ListVariants["data"][number],
):
	| ProductPriceOneTimeFixedCreate
	| ProductPriceRecurringFixedCreate
	| ProductPriceOneTimeCustomCreate
	| ProductPriceOneTimeFreeCreate
	| ProductPriceRecurringFreeCreate => {
	const priceCurrency = "usd";
	const priceAmount = variant.attributes.price;

	if (variant.attributes.is_subscription) {
		const interval = variant.attributes.interval;

		if (priceAmount > 0) {
			return {
				type: "recurring",
				recurringInterval: resolveInterval(interval),
				amountType: "fixed",
				priceAmount,
				priceCurrency,
			} as ProductPriceRecurringFixedCreate;
		}

		return {
			type: "recurring",
			amountType: "free",
			recurringInterval: resolveInterval(interval),
		} as ProductPriceRecurringFreeCreate;
	}

	const payWhatYouWant = variant.attributes.pay_what_you_want;

	if (payWhatYouWant) {
		return {
			type: "one_time",
			amountType: "custom",
			priceAmount,
			priceCurrency,
			minimumAmount:
				variant.attributes.min_price < 50 ? 50 : variant.attributes.min_price,
			presetAmount: variant.attributes.suggested_price,
		} as ProductPriceOneTimeCustomCreate;
	}

	if (priceAmount > 0) {
		return {
			type: "one_time",
			amountType: "fixed",
			priceAmount,
			priceCurrency,
		} as ProductPriceOneTimeFixedCreate;
	}

	return {
		type: "one_time",
		amountType: "free",
	} as ProductPriceOneTimeFreeCreate;
};

const resolveLicenseKeyExpiration = (
	variant: ListVariants["data"][number],
): BenefitLicenseKeyExpirationProperties => {
	let timeframe: Timeframe;

	switch (variant.attributes.license_length_unit) {
		case "days":
			timeframe = "day";
			break;
		case "months":
			timeframe = "month";
			break;
		case "years":
			timeframe = "year";
			break;
	}

	return {
		timeframe,
		ttl: variant.attributes.license_length_value,
	};
};

export const createProduct = async (
	api: Polar,
	organization: Organization,
	variant: ListVariants["data"][number],
	lemonProduct: ListProducts["data"][number],
) => {
	const price = resolvePrice(variant);
	const isDefault = variant.attributes.name === "Default";

	const productName = isDefault
		? (lemonProduct?.attributes.name ?? variant.attributes.name)
		: `${lemonProduct?.attributes.name} - ${variant.attributes.name}`;

	const description = isDefault
		? lemonProduct?.attributes.description
		: variant.attributes.description;

	// Split creation based on price type
	const createParams: ProductOneTimeCreate | ProductRecurringCreate = {
		name: productName,
		// @ts-expect-error
		prices: [price] as const,
		description: description,
		organizationId: organization.id,
	};

	const product = await api.products.create(createParams);

	if (variant.attributes.has_license_keys) {
		const benefit = await api.benefits.create({
			type: "license_keys",
			description: `${productName} License Key`,
			properties: {
				expires: variant.attributes.is_license_length_unlimited
					? undefined
					: resolveLicenseKeyExpiration(variant),
				activations: variant.attributes.license_activation_limit
					? {
							limit: variant.attributes.license_activation_limit,
							enableUserAdmin: true,
						}
					: undefined,
			},
			organizationId: organization.id,
		});

		await api.products.updateBenefits({
			id: product.id,
			productBenefitsUpdate: {
				benefits: [benefit.id],
			},
		});
	}

	return product;
};
