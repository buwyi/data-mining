import { ProjectFlowCanvas } from '../ProjectFlowCanvas'

export type ProjectFlowPreviewProps = {
  height?: number
}

/** 只读流程预览，与编辑画布共用 `ProjectFlowCanvas`。 */
export function ProjectFlowPreview({ height = 440 }: ProjectFlowPreviewProps) {
  return <ProjectFlowCanvas height={height} readOnly />
}
