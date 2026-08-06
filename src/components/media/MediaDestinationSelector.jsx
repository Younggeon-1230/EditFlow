import { Link } from 'react-router-dom'
import ProjectSelector from '../checklist/ProjectSelector.jsx'
import { ROUTES } from '../../constants/app.js'

function MediaDestinationSelector({
  destinationType,
  onDestinationTypeChange,
  projects,
  selectedProjectId,
  onProjectChange,
  ideas,
  selectedIdeaId,
  onIdeaChange,
  isLoadingIdeas,
  ideaError,
}) {
  return (
    <section className="media-destination" aria-labelledby="media-destination-title">
      <div className="media-destination-heading">
        <div><p className="resource-type">SAVE DESTINATION</p><strong id="media-destination-title">저장 대상</strong></div>
        <div className="media-destination-types" role="radiogroup" aria-label="저장 대상 종류">
          <label><input checked={destinationType === 'project'} name="destinationType" onChange={() => onDestinationTypeChange('project')} type="radio" /> 프로젝트</label>
          <label><input checked={destinationType === 'idea'} name="destinationType" onChange={() => onDestinationTypeChange('idea')} type="radio" /> 콘텐츠 소재</label>
        </div>
      </div>

      {destinationType === 'project' ? (
        <><ProjectSelector onChange={onProjectChange} projects={projects} selectedProjectId={selectedProjectId} /><p className="media-destination-help">선택한 프로젝트에 저장합니다.</p></>
      ) : (
        <div className="idea-destination-selector">
          <label htmlFor="media-content-idea">콘텐츠 소재 선택</label>
          {isLoadingIdeas ? <p role="status">콘텐츠 소재를 불러오는 중입니다.</p> : ideaError ? <p role="alert">콘텐츠 소재 목록을 불러오지 못했습니다. {ideaError}</p> : ideas.length === 0 ? <p>저장할 콘텐츠 소재가 없습니다. <Link to={ROUTES.ideas}>콘텐츠 소재 만들기</Link></p> : <select id="media-content-idea" onChange={(event) => onIdeaChange(Number(event.target.value))} value={selectedIdeaId ?? ''}>{ideas.map((idea) => <option key={idea.id} value={idea.id}>{idea.title} · {idea.status} · {idea.platform}</option>)}</select>}
          <p className="media-destination-help">선택한 콘텐츠 소재에 저장합니다. 프로젝트로 전환하면 저장 자료가 함께 복사됩니다.</p>
        </div>
      )}
    </section>
  )
}

export default MediaDestinationSelector
