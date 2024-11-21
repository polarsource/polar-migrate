import type { ListProducts, ListVariants } from "@lemonsqueezy/lemonsqueezy.js";
import prompts from "prompts";

export const variantsPrompt = async (
	variants: ListVariants["data"],
	products: ListProducts["data"],
) => {
	const { variantIds } = await prompts([
		{
			type: "multiselect",
			name: "variantIds",
			message: "Select variants to migrate",
			choices: variants
				.filter((variant) => variant.attributes.status !== "draft")
				.map((variant) => {
					const product = products.find(
						(product) =>
							product.id === variant.attributes.product_id.toString(),
					);

					const isDefault = variant.attributes.name === "Default";
					return {
						title: isDefault
							? (product?.attributes.name ?? "")
							: `${product?.attributes.name} - ${variant.attributes.name}`,
						value: variant.id,
						selected: true,
					};
				}),
		},
	]);

	return variants.filter((variant) => variantIds.includes(variant.id));
};
