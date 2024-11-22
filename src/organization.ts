import type { Polar } from "@polar-sh/sdk";
import type { Organization } from "@polar-sh/sdk/models/components/organization.js";
import {
	createOrganizationPrompt,
	selectOrganizationPrompt,
} from "./prompts/organization.js";

export const resolveOrganization = async (
	api: Polar,
	storeSlug: string,
): Promise<Organization> => {
	// Get list of organizations user is member of
	const userOrganizations = (
		await api.organizations.list({
			limit: 100,
		})
	).result.items;

	// If user has organizations, prompt them to select one
	const organization = await selectOrganizationPrompt(userOrganizations);

	if (organization) {
		return organization;
	}

	const orgsWithSlug = await api.organizations.list({
		slug: storeSlug,
	});

	const orgExists = orgsWithSlug.result.items.length > 0;

	if (orgExists) {
		const newSlug = await createOrganizationPrompt();

		return await api.organizations.create({
			name: newSlug,
			slug: newSlug,
		});
	}

	const newSlug = await createOrganizationPrompt(storeSlug);

	return await api.organizations.create({
		name: newSlug,
		slug: newSlug,
	});
};
