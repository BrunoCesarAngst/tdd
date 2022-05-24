import { reset, set } from 'mockdate'

class EventStatus {
  status: 'active' | 'inReview' | 'done'

  constructor (event?: { endDate: Date, reviewDurationInHours: number }) {
    if (event === undefined) {
      this.status = 'done'
      return
    }
    const now = new Date()
    if (event.endDate >= now) {
      this.status = 'active'
      return
    }
    const reviewDurationInMilliseconds = event.reviewDurationInHours * 60 * 60 * 1000
    const reviewEndDate = new Date(event.endDate.getTime() + reviewDurationInMilliseconds)
    this.status = reviewEndDate >= now ? 'inReview' : 'done'
  }
}

class CheckLastEventStatus {
  constructor (private readonly loadLastEventRepository: LoadLastEventRepository) { }

  async perform ({ groupId }: {groupId: string}): Promise<EventStatus> {
    const event = await this.loadLastEventRepository.loadLastEvent({ groupId })

    return new EventStatus(event)
  }
}

interface LoadLastEventRepository {
  loadLastEvent: (input: {groupId: string}) => Promise<{endDate: Date, reviewDurationInHours: number} | undefined>
}

class LoadLastEventRepositorySpy implements LoadLastEventRepository {
  groupId?: string
  callsCount = 0
  output?: {endDate: Date, reviewDurationInHours: number}

  setEndDateAfterNow (): void {
    this.output = {
      endDate: new Date(new Date().getTime() + 1),
      reviewDurationInHours: 1
    }
  }

  setEndDateEqualToNow (): void {
    this.output = {
      endDate: new Date(),
      reviewDurationInHours: 1
    }
  }

  setEndDateBeforeToNow (): void {
    this.output = {
      endDate: new Date(new Date().getTime() - 1),
      reviewDurationInHours: 1
    }
  }

  async loadLastEvent ({ groupId }: {groupId: string}): Promise<{endDate: Date, reviewDurationInHours: number} | undefined> {
    this.groupId = groupId
    this.callsCount++
    return this.output
  }
}

type SutOutput = {
  sut: CheckLastEventStatus
  loadLastEventRepository: LoadLastEventRepositorySpy
}

const makeSut = (): SutOutput => {
  const loadLastEventRepository = new LoadLastEventRepositorySpy()
  const sut = new CheckLastEventStatus(loadLastEventRepository)
  return { sut, loadLastEventRepository }
}

describe('CheckLastEventStatus', () => {
  const groupId = 'any_group_id'

  beforeAll(() => {
    set(new Date())
  })

  afterAll(() => {
    reset()
  })

  it('should get last event data', async () => {
    const { sut, loadLastEventRepository } = makeSut()

    await sut.perform({ groupId })

    expect(loadLastEventRepository.groupId).toBe('any_group_id')
    expect(loadLastEventRepository.callsCount).toBe(1)
  })

  it('should return status done when group has no event', async () => {
    const { sut, loadLastEventRepository } = makeSut()
    loadLastEventRepository.output = undefined

    const EventStatus = await sut.perform({ groupId })

    expect(EventStatus.status).toBe('done')
  })

  it('should return status active when now is before event end time', async () => {
    const { sut, loadLastEventRepository } = makeSut()
    loadLastEventRepository.setEndDateAfterNow()

    const EventStatus = await sut.perform({ groupId })

    expect(EventStatus.status).toBe('active')
  })

  it('should return status active when now is equal to event end time', async () => {
    const { sut, loadLastEventRepository } = makeSut()
    loadLastEventRepository.setEndDateEqualToNow()

    const EventStatus = await sut.perform({ groupId })

    expect(EventStatus.status).toBe('active')
  })

  it('should return status inReview when now is after event end time', async () => {
    const { sut, loadLastEventRepository } = makeSut()
    loadLastEventRepository.setEndDateBeforeToNow()

    const EventStatus = await sut.perform({ groupId })

    expect(EventStatus.status).toBe('inReview')
  })

  it('should return status inReview when now is before review time', async () => {
    const reviewDurationInHours = 1
    const reviewDurationInMilliseconds = 1000 * 60 * 60 * reviewDurationInHours
    const { sut, loadLastEventRepository } = makeSut()
    loadLastEventRepository.output = {
      endDate: new Date(new Date().getTime() + 1 - reviewDurationInMilliseconds),
      reviewDurationInHours
    }

    const EventStatus = await sut.perform({ groupId })

    expect(EventStatus.status).toBe('inReview')
  })

  it('should return status inReview when now equal to review time', async () => {
    const reviewDurationInHours = 1
    const reviewDurationInMilliseconds = 1000 * 60 * 60 * reviewDurationInHours
    const { sut, loadLastEventRepository } = makeSut()
    loadLastEventRepository.output = {
      endDate: new Date(new Date().getTime() - reviewDurationInMilliseconds),
      reviewDurationInHours
    }

    const EventStatus = await sut.perform({ groupId })

    expect(EventStatus.status).toBe('inReview')
  })

  it('should return status inReview when now after review time', async () => {
    const reviewDurationInHours = 1
    const reviewDurationInMilliseconds = 1000 * 60 * 60 * reviewDurationInHours
    const { sut, loadLastEventRepository } = makeSut()
    loadLastEventRepository.output = {
      endDate: new Date(new Date().getTime() - 1 - reviewDurationInMilliseconds),
      reviewDurationInHours
    }

    const EventStatus = await sut.perform({ groupId })

    expect(EventStatus.status).toBe('done')
  })
})
