import { listDiscounts } from "@lemonsqueezy/lemonsqueezy.js";
import { Polar } from "@polar-sh/sdk";
import type { Customer } from "@polar-sh/sdk/models/components/customer.js";
import type { Discount } from "@polar-sh/sdk/models/components/discount.js";
import type { Product } from "@polar-sh/sdk/models/components/product.js";
import meow from "meow";
import open from "open";
import { importCustomers } from "./customers.js";
import { createLemonClient } from "./lemon.js";
import { login } from "./oauth.js";
import { resolveOrganization } from "./organization.js";
import { createProduct } from "./product.js";
import { lemonAccessKeyPrompt } from "./prompts/lemonAccessKey.js";
import { serverPrompt } from "./prompts/server.js";
import { stepsPrompt } from "./prompts/steps.js";
import { storePrompt } from "./prompts/store.js";
import { variantsPrompt } from "./prompts/variants.js";
import { authenticationMessage } from "./ui/authentication.js";
import { customersMessage } from "./ui/customers.js";
import { successMessage } from "./ui/success.js";

process.on("uncaughtException", (error) => {
	console.error(error);
	process.exit(1);
});

process.on("unhandledRejection", (error) => {
	console.error(error);
	process.exit(1);
});

meow(
	`
	Usage
	  $ polar-migrate
`,
	{
		importMeta: import.meta,
	},
);

(async () => {
	const lemonAccessKey = await lemonAccessKeyPrompt();

	const lemon = await createLemonClient(lemonAccessKey);

	const stores = await lemon.listStores();
	const store = await storePrompt(stores.data?.data ?? []);

	if (!store) {
		console.error("No store selected");
		process.exit(1);
	}

	const server = await serverPrompt();

	await authenticationMessage();
	const code = await login(server);

	const polar = new Polar({
		accessToken: code,
		server,
	});

	const variantWithProductMap = new Map<string, Product>();
	let productsCreated: { product: Product; variantId: string }[] = [];
	let discountsCreated: Discount[] = [];
	let customersCreated: Customer[] = [];

	const steps = await stepsPrompt();

	const organization = await resolveOrganization(polar, store.attributes.slug);

	if (steps.includes("products")) {
		const products = await lemon.listProducts({
			filter: {
				storeId: store.id,
			},
		});

		const productVariants = (
			await Promise.all(
				products.data?.data?.map(async (product) => {
					const storeVariants = await lemon.listVariants({
						filter: {
							productId: product.id,
						},
					});
					return storeVariants.data?.data ?? [];
				}) ?? [],
			)
		).flat();

		const variants = await variantsPrompt(
			productVariants,
			products.data?.data ?? [],
		);

		const createdProducts = await Promise.all(
			variants.map((variant) => {
				const lemonProduct = products.data?.data?.find(
					(product) => product.id === variant.attributes.product_id.toString(),
				);

				if (!lemonProduct) {
					console.error(`Product not found for variant ${variant.id}`);
					process.exit(1);
				}

				return createProduct(polar, organization, variant, lemonProduct);
			}),
		);

		for (const product of createdProducts) {
			variantWithProductMap.set(product.variantId, product.product);
		}

		productsCreated = createdProducts;
	}

	if (steps.includes("discounts")) {
		const discounts = await listDiscounts({
			filter: {
				storeId: store.id,
			},
			include: ["variants"],
		});

		const publishedDiscounts =
			discounts.data?.data?.filter(
				(discount) => discount.attributes.status === "published",
			) ?? [];

		try {
			discountsCreated = await Promise.all(
				publishedDiscounts.map((discount) => {
					const commonProps = {
						code: discount.attributes.code,
						duration: discount.attributes.duration,
						durationInMonths: discount.attributes.duration_in_months,
						name: discount.attributes.name,
						maxRedemptions: discount.attributes.is_limited_redemptions
							? Math.max(discount.attributes.max_redemptions, 1)
							: undefined,
						startsAt: discount.attributes.starts_at
							? new Date(discount.attributes.starts_at)
							: undefined,
						endsAt: discount.attributes.expires_at
							? new Date(discount.attributes.expires_at)
							: undefined,
						organizationId: organization.id,
					};

					const productsToAssociateWithDiscount =
						discount.relationships.variants.data
							?.map((variant) => variantWithProductMap.get(variant.id)?.id)
							.filter((id): id is string => id !== undefined) ?? [];

					if (discount.attributes.amount_type === "fixed") {
						return polar.discounts.create({
							...commonProps,
							amount: discount.attributes.amount,
							type: "fixed",
							products:
								productsToAssociateWithDiscount?.length > 0
									? productsToAssociateWithDiscount
									: undefined,
						});
					}

					return polar.discounts.create({
						...commonProps,
						basisPoints: discount.attributes.amount * 100,
						type: "percentage",
						products:
							productsToAssociateWithDiscount?.length > 0
								? productsToAssociateWithDiscount
								: undefined,
					});
				}),
			);
		} catch (e) {}
	}

	if (steps.includes("customers")) {
		const customers = await customersMessage(
			importCustomers(polar, store, organization),
		);

		const customersWithoutNulls = customers.filter(
			(customer): customer is Customer => customer !== null,
		);

		customersCreated = customersWithoutNulls;
	}

	await successMessage(
		organization,
		productsCreated.map((p) => p.product),
		discountsCreated,
		customersCreated,
		server,
	);

	open(
		`https://${server === "sandbox" ? "sandbox." : ""}polar.sh/dashboard/${
			organization.slug
		}/products`,
	);

	process.exit(0);
})();
