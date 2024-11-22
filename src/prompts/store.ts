import type { ListStores } from "@lemonsqueezy/lemonsqueezy.js";
import prompts from "prompts";

export const storePrompt = async (stores: ListStores["data"]) => {
	const { storeId } = await prompts([
		{
			type: "select",
			name: "storeId",
			message: "Select a store",
			choices: stores.map((store) => ({
				title: store.attributes.name,
				value: store.id,
			})),
		},
	]);

	const selectedStore = stores.find((store) => store.id === storeId);

	if (!selectedStore) {
		throw new Error("Store not found");
	}

	if (selectedStore.attributes.currency !== "USD") {
		throw new Error("Store Currency must be USD");
	}

	return selectedStore;
};
