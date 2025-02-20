import {
	type Customer,
	type Store,
	listCustomers,
} from "@lemonsqueezy/lemonsqueezy.js";
import type { Polar } from "@polar-sh/sdk";
import type { Organization } from "@polar-sh/sdk/models/components/organization.js";

const importCustomer = async (
	polar: Polar,
	customer: Customer["data"],
	organization: Organization,
) => {
	try {
		return await polar.customers.create({
			organizationId: organization.id,
			email: customer.attributes.email,
			name: customer.attributes.name,
			billingAddress: {
				city: customer.attributes.city,
				state: customer.attributes.region,
				country: customer.attributes.country as string,
			},
		});
	} catch (error) {
		return null;
	}
};

export const importCustomers = async (
	polar: Polar,
	store: Store["data"],
	organization: Organization,
) => {
	const customers = await listCustomers({
		filter: {
			storeId: store.id,
		},
		page: {
			number: 1,
			size: 50,
		},
	});

	const allCustomers = [];
	let currentPage = 1;
	const lastPage = customers.data?.meta.page.lastPage ?? 1;

	// Get first page results
	if (customers.data?.data) {
		allCustomers.push(...customers.data.data);
	}

	// Get remaining pages
	while (currentPage < lastPage) {
		currentPage++;
		const nextPage = await listCustomers({
			filter: {
				storeId: store.id,
			},
			page: {
				number: currentPage,
				size: 50,
			},
		});

		if (nextPage.data?.data) {
			allCustomers.push(...nextPage.data.data);
		}
	}

	return promiseAllInBatches(
		(customer) => importCustomer(polar, customer, organization),
		allCustomers,
		50,
	);
};

/**
 * Same as Promise.all(items.map(item => task(item))), but it waits for
 * the first {batchSize} promises to finish before starting the next batch.
 *
 * @template A
 * @template B
 * @param {function(A): B} task The task to run for each item.
 * @param {A[]} items Arguments to pass to the task for each call.
 * @param {int} batchSize
 * @returns {Promise<B[]>}
 */
async function promiseAllInBatches<A, B>(
	task: (item: A) => Promise<B>,
	items: A[],
	batchSize: number,
) {
	let position = 0;
	let results: B[] = [];
	while (position < items.length) {
		const itemsForBatch = items.slice(position, position + batchSize);
		results = [
			...results,
			...(await Promise.all(itemsForBatch.map((item) => task(item)))),
		];
		position += batchSize;
	}
	return results;
}
