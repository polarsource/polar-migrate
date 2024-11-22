import { Polar } from "@polar-sh/sdk";
import meow from "meow";
import open from "open";
import { createLemonClient } from "./lemon.js";
import { login } from "./oauth.js";
import { resolveOrganization } from "./organization.js";
import { createProduct } from "./product.js";
import { lemonAccessKeyPrompt } from "./prompts/lemonAccessKey.js";
import { serverPrompt } from "./prompts/server.js";
import { storePrompt } from "./prompts/store.js";
import { variantsPrompt } from "./prompts/variants.js";
import { authenticationMessage } from "./ui/authentication.js";
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

	const server = await serverPrompt();

	await authenticationMessage();
	const code = await login(server);

	const polar = new Polar({
		accessToken: code,
		server,
	});

	const organization = await resolveOrganization(polar, store.attributes.slug);

	const createdProducts = await Promise.all(
		variants.map((variant) => {
			const product = products.data?.data?.find(
				(product) => product.id === variant.attributes.product_id.toString(),
			);

			if (!product) {
				console.error(`Product not found for variant ${variant.id}`);
				process.exit(1);
			}

			return createProduct(polar, organization, variant, product);
		}),
	);

	await successMessage(organization, createdProducts, server);

	open(
		`https://${server === "sandbox" ? "sandbox." : ""}polar.sh/dashboard/${
			organization.slug
		}/products`,
	);

	process.exit(0);
})();
