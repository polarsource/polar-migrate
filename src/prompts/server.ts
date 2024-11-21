import prompts from "prompts";

export const serverPrompt = async () => {
	const { server } = await prompts({
		type: "select",
		name: "server",
		message: "Which Polar environment would you like to run the migration in?",
		choices: [
			{ title: "Sandbox", value: "sandbox" },
			{ title: "Production", value: "production" },
		],
	});

	return server;
};
