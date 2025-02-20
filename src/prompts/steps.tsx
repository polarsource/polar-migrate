import prompts from "prompts";

export const stepsPrompt = async () => {
	const { steps } = await prompts([
		{
			type: "multiselect",
			name: "steps",
			message: "Select what to migrate",
			choices: [
				{
					title: "Products",
					value: "products",
					selected: true,
				},
				{
					title: "Discounts",
					value: "discounts",
					selected: true,
				},
				{
					title: "Customers",
					value: "customers",
					selected: true,
				},
			],
		},
	]);

	return steps;
};
