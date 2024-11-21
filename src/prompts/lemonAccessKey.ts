import prompts from "prompts";

export const lemonAccessKeyPrompt = async () => {
	const { lemonAccessKey } = await prompts([
		{
			type: "password",
			name: "lemonAccessKey",
			message: "Enter your LemonSqueezy API Key",
		},
	]);

	return lemonAccessKey;
};
