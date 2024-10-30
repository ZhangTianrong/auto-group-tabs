import { expect, test } from '@playwright/test'
import msg from '../../../static/_locales/en/messages.json'
import {
  getGroups,
  getValue,
  GroupConfigurationWithoutId,
  isMacOS,
  setGroups
} from '../util/evaluations'

test.use({
  viewport: {
    width: 400,
    height: 600
  },
  headless: false
})

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:16655/?context=options')

  // Define groups programmatically
  await page.evaluate(setGroups, [
    {
      title: 'Test Group',
      color: 'blue',
      matchers: [],
      options: { strict: true, merge: true }
    } as GroupConfigurationWithoutId
  ])

  // Reload the page to apply localStorage changes
  await page.reload()
})

test('Edit and save groups', async ({ page }) => {
  // Find "edit" button and click it
  await page.locator('text=edit').click()

  // Await the dialog container to appear
  const dialogContainer = page.locator('.dialog-container')
  await expect(dialogContainer).toHaveCount(1)

  // Expect initial group preview to be empty and grey
  const previewLabel = dialogContainer.locator('.preview .group-label')
  expect(await previewLabel.textContent()).toBe('Test Group')

  const getBackgroundColor = (element: HTMLElement | SVGElement) =>
    getComputedStyle(element).backgroundColor
  expect(await previewLabel.evaluate(getBackgroundColor)).toBe(
    'rgb(62, 115, 232)'
  )

  // Expect initial group name input to be empty
  const groupNameInput = dialogContainer.locator('mwc-textfield.group-title')
  expect(await groupNameInput.evaluate(getValue)).toBe('Test Group')

  // Focus and override name field
  // await groupNameInput.click()
  const primaryKey = (await page.evaluate(isMacOS)) ? 'Meta' : 'Control'
  await groupNameInput.click()
  await page.keyboard.down(primaryKey)
  page.keyboard.press('A')
  await page.keyboard.up(primaryKey)

  await groupNameInput.press('Backspace')
  await groupNameInput.pressSequentially('Edited Group')

  // Click the red radio label to select the color
  await dialogContainer.locator(`text=${msg.colorRed.message}`).click()

  // Show advanced options
  await dialogContainer.locator('.toggle-advanced-button').click()

  // Toggle strict mode off
  await dialogContainer.locator('#edit-dialog-strict').click()

  // Toggle merge mode off
  await dialogContainer.locator('#edit-dialog-merge').click()

  // Expect the preview to have updated
  expect(await previewLabel.textContent()).toBe('Edited Group')
  expect(await previewLabel.evaluate(getBackgroundColor)).toBe(
    'rgb(217, 48, 36)'
  )

  // Save the group
  await dialogContainer.locator(`text=${msg.buttonSave.message}`).click()

  // Wait for the dialog container to be gone
  await expect(page.locator('.dialog-container')).toHaveCount(0)

  // Check tag in groups list
  const groupsListTag = page.locator('.groups .group .tag')
  await expect(groupsListTag).toHaveCount(1)
  expect(await groupsListTag.textContent()).toBe('Edited Group')
  expect(await groupsListTag.evaluate(getBackgroundColor)).toBe(
    'rgb(217, 48, 36)'
  )

  // Validate groups structure in storage
  expect(await page.evaluate(getGroups)).toMatchObject([
    {
      id: expect.any(String),
      title: 'Edited Group',
      color: 'red',
      matchers: [],
      options: { strict: false, merge: false }
    }
  ])
})

test('Delete Groups and undo deletion', async ({ page }) => {
  // Find "edit" button and click it
  await page.locator('text=edit').click()

  // Await the dialog container to appear
  const dialogContainer = page.locator('.dialog-container')
  await expect(dialogContainer).toHaveCount(1)

  await dialogContainer.locator(`text=${msg.buttonDeleteGroup.message}`).click()

  // Expect the dialog to disappear
  await expect(page.locator('.dialog-container')).toHaveCount(0)

  // Validate that the group is also gone from storage
  expect(await page.evaluate(getGroups)).toEqual([])

  // Press the "undo" button
  await page.locator(`text=${msg.undo.message}`).click()

  // Validate groups structure in storage
  expect(await page.evaluate(getGroups)).toMatchObject([
    {
      id: expect.any(String),
      title: 'Test Group',
      color: 'blue',
      matchers: [],
      options: { strict: true, merge: true }
    }
  ])
})
